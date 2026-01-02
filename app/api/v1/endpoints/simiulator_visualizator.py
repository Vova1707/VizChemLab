import httpx
import re
from fastapi import APIRouter, Body, Depends, HTTPException
from urllib.parse import quote
import numpy as np
import random
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from app.api.v1.endpoints import simiulator as sim
from app.db.session import get_db
from app.db.models import SearchHistory, User
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.utils import pubchem

router = APIRouter()

@router.post("/api/simulator/lookup-formula")
async def lookup_formula_simulator(
    formula: str = Body(..., embed=True),
):
    """Поиск SDF по химической формуле для симулятора"""
    sdf = await pubchem.fetch_pubchem_sdf_by_formula(formula, record_type="3d")
    if not sdf:
        raise HTTPException(status_code=404, detail="Compound not found for this formula")
    return {"sdf": sdf}


async def _get_sdf_any(compound: str) -> str | None:
    print(f"[sdf] Searching for: {compound}")
    # Удаляем коэффициенты и пробелы
    compound = compound.strip()
    
    # 1. Определяем, является ли ввод формулой (HF, H2O, SiO2)
    is_formula = bool(re.match(r'^([A-Z][a-z]?\d*)+$', compound))
    
    queries = []
    
    # ПРИОРИТЕТ 1: Если это формула, пробуем найти IUPAC название через API
    # Это заменяет alias_map и делает поиск более точным
    if is_formula:
        api_name = await pubchem.fetch_name_by_formula(compound)
        if api_name:
            queries.append(api_name)
    
    # ПРИОРИТЕТ 2: Перевод (если ввели на русском)
    trans = await pubchem._maybe_translate_to_en(compound)
    if trans and trans not in queries:
        queries.append(trans)
    
    # ПРИОРИТЕТ 3: Исходная строка
    if compound not in queries:
        queries.append(compound)
        
    for q in queries:
        # Для каждого запроса в списке пробуем найти SDF
        is_q_formula = bool(re.match(r'^([A-Z][a-z]?\d*)+$', q))
        for record_type in ("3d", "2d"):
            try:
                # Если текущий запрос q выглядит как формула — приоритет поиску по формуле
                if is_q_formula:
                    sdf = await pubchem.fetch_pubchem_sdf_by_formula(q, record_type=record_type)
                    if sdf:
                        print(f"[sdf] Found SDF for {compound} (formula: {q}, {record_type})")
                        return sdf
                    sdf = await pubchem.fetch_pubchem_sdf_by_name(q, record_type=record_type)
                    if sdf:
                        print(f"[sdf] Found SDF for {compound} (name: {q}, {record_type})")
                        return sdf
                else:
                    # Если это название (например "hydrogen fluoride") — приоритет поиску по имени
                    sdf = await pubchem.fetch_pubchem_sdf_by_name(q, record_type=record_type)
                    if sdf:
                        print(f"[sdf] Found SDF for {compound} (name: {q}, {record_type})")
                        return sdf
                    sdf = await pubchem.fetch_pubchem_sdf_by_formula(q, record_type=record_type)
                    if sdf:
                        print(f"[sdf] Found SDF for {compound} (formula: {q}, {record_type})")
                        return sdf
            except Exception as e:
                print(f"[sdf] Error fetching {q} ({record_type}): {e}")
                continue

    # 3. ПОСЛЕДНИЙ ШАНС: Генерация SDF для молекул/атомов вручную, если PubChem молчит
    # Парсим формулу, чтобы понять состав
    elements_dict = sim._parse_formula(compound)
    if elements_dict:
        print(f"[sdf] Generating fallback SDF for: {compound}")
        # Генерируем "облако" атомов
        total_atoms = sum(elements_dict.values())
        sdf_lines = [
            "",
            "  Fallback",
            "",
            f"{total_atoms:3d}  0  0  0  0  0  0  0  0  0999 V2000"
        ]
        
        # Расставляем атомы по кругу или случайно
        idx = 0
        for el, count in elements_dict.items():
            for _ in range(count):
                # Простая расстановка по спирали/сфере
                phi = np.pi * (3. - np.sqrt(5.)) * idx
                y = 1 - (idx / float(total_atoms - 1)) * 2 if total_atoms > 1 else 0
                radius = np.sqrt(1 - y * y) if total_atoms > 1 else 0
                x = np.cos(phi) * radius
                z = np.sin(phi) * radius
                
                # Масштабируем
                scale = 1.5
                sdf_lines.append(f"{x*scale:10.4f}{y*scale:10.4f}{z*scale:10.4f} {el.ljust(3)} 0  0  0  0  0  0  0  0  0  0  0  0")
                idx += 1
        
        sdf_lines.append("M  END")
        return "\n".join(sdf_lines)

    print(f"[sdf] FAILED to find SDF for {compound}")
    return None


def _parse_side_coeffs(side: str) -> dict[str, int]:
    """Парсим строку вида '2H2 + O2' и возвращаем {formula: coeff}."""
    coeffs: dict[str, int] = {}
    for part in side.split("+"):
        token = part.strip()
        if not token:
            continue
        m = re.match(r"^\s*(\d+)?\s*(.*)$", token)
        if not m:
            continue
        coeff = int(m.group(1)) if m.group(1) else 1
        formula = sim._strip_leading_coeff(m.group(2))
        coeffs[formula] = coeffs.get(formula, 0) + coeff
    return coeffs


def _parse_sdf_atoms_and_components(sdf: str):
    """Извлекает атомы, связи и группы (молекулы) по связности из SDF."""
    lines = sdf.strip().splitlines()
    if len(lines) < 4:
        return [], []

    counts_line = lines[3]
    try:
        atom_count = int(counts_line[0:3])
        bond_count = int(counts_line[3:6])
    except ValueError:
        return [], []

    atoms = []
    # Фолбэк на случай огромных SDF
    max_atoms = 100
    
    # Эвристика для "огромных" структур (кристаллические решетки)
    is_single_element = atom_count > 10
    
    for i in range(4, 4 + min(atom_count, max_atoms)):
        parts = lines[i].split()
        if len(parts) < 4:
            continue
        x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
        element = parts[3].strip()
        atoms.append({"element": element, "x": x, "y": y, "z": z})
        
    if is_single_element and all(a['element'] == atoms[0]['element'] for a in atoms):
        atoms = atoms[:1]
        atom_count = 1
        bond_count = 0

    adj = [[] for _ in range(atom_count)]
    bond_start = 4 + atom_count
    for i in range(bond_start, bond_start + bond_count):
        if i >= len(lines):
            break
        line = lines[i]
        try:
            a = int(line[0:3]) - 1
            b = int(line[3:6]) - 1
        except ValueError:
            continue
        if 0 <= a < atom_count and 0 <= b < atom_count:
            adj[a].append(b)
            adj[b].append(a)

    visited = [False] * atom_count
    components: list[list[int]] = []
    for idx in range(atom_count):
        if visited[idx]:
            continue
        stack = [idx]
        comp = []
        visited[idx] = True
        while stack:
            v = stack.pop()
            comp.append(v)
            for nb in adj[v]:
                if not visited[nb]:
                    visited[nb] = True
                    stack.append(nb)
        components.append(comp)

    molecules = []
    for comp in components:
        mol_atoms = [atoms[i] for i in comp]
        molecules.append(mol_atoms)

    return atoms, molecules


def _center_molecule(atoms):
    """Центрирует молекулу в начале координат (0,0,0)."""
    if not atoms:
        return []
    avg_x = sum(a['x'] for a in atoms) / len(atoms)
    avg_y = sum(a['y'] for a in atoms) / len(atoms)
    avg_z = sum(a['z'] for a in atoms) / len(atoms)
    return [{**a, 'x': a['x'] - avg_x, 'y': a['y'] - avg_y, 'z': a['z'] - avg_z} for a in atoms]

def interpolate_coords(start, end, alpha):
    """Интерполирует координаты с добавлением хаотичного движения для эффекта реакции."""
    noise_scale = 0.2 * (1.0 - abs(alpha - 0.5) * 2.0)  # Максимум шума на середине (t=0.5)
    dx = random.uniform(-noise_scale, noise_scale)
    dy = random.uniform(-noise_scale, noise_scale)
    dz = random.uniform(-noise_scale, noise_scale)
    
    # Если элементы разные, плавно меняем их (на фронтенде это будет смена цвета)
    # Мы оставляем тип элемента как 'start' до середины, затем переключаем на 'end'
    # Это "стандартный" подход для 3Dmol, так как он не умеет в интерполяцию типов
    return {
        'element': start['element'] if alpha < 0.5 else end['element'],
        'x': start['x'] * (1 - alpha) + end['x'] * alpha + dx,
        'y': start['y'] * (1 - alpha) + end['y'] * alpha + dy,
        'z': start['z'] * (1 - alpha) + end['z'] * alpha + dz,
    }

def _match_atoms(r_atoms, p_atoms):
    """Пытается сопоставить атомы двух молекул для более красивого морфинга."""
    r_rem = list(r_atoms)
    p_rem = list(p_atoms)
    matched = []
    
    # Сначала сопоставляем атомы одного и того же элемента
    for r_at in list(r_rem):
        for p_at in list(p_rem):
            if r_at['element'] == p_at['element']:
                matched.append((r_at, p_at))
                r_rem.remove(r_at)
                p_rem.remove(p_at)
                break
                
    # Остальные сопоставляем просто по порядку
    while r_rem and p_rem:
        matched.append((r_rem.pop(0), p_rem.pop(0)))
        
    return matched, r_rem, p_rem

def _parse_sdf_atoms_and_bonds(sdf: str):
    """Извлекает атомы и связи из SDF."""
    lines = sdf.strip().splitlines()
    if len(lines) < 4:
        return [], []

    counts_line = lines[3]
    try:
        atom_count = int(counts_line[0:3])
        bond_count = int(counts_line[3:6])
    except ValueError:
        return [], []

    atoms = []
    for i in range(4, 4 + atom_count):
        parts = lines[i].split()
        if len(parts) < 4:
            continue
        x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
        element = parts[3].strip()
        atoms.append({"element": element, "x": x, "y": y, "z": z})

    bonds = []
    bond_start = 4 + atom_count
    for i in range(bond_start, bond_start + bond_count):
        if i >= len(lines):
            break
        line = lines[i]
        try:
            a = int(line[0:3]) - 1
            b = int(line[3:6]) - 1
            order = int(line[6:9]) if len(line) >= 9 else 1
            bonds.append({"start": a, "end": b, "order": order})
        except ValueError:
            continue

    return atoms, bonds

async def _collect_models(left: list[str], right: list[str]):
    """
    Возвращаем модели с явной стороной (reactant/product), без дублирования.
    """
    candidates: list[tuple[str, str]] = []
    for comp in left:
        cleaned = sim._strip_leading_coeff(comp)
        if cleaned:
            candidates.append((cleaned, "reactant"))
    for comp in right:
        cleaned = sim._strip_leading_coeff(comp)
        if cleaned:
            candidates.append((cleaned, "product"))

    seen = set()
    models = []
    for comp, side in candidates:
        key = (comp, side)
        if key in seen:
            continue
        seen.add(key)
        sdf = await _get_sdf_any(comp)
        if not sdf:
            continue
        atoms, bonds = _parse_sdf_atoms_and_bonds(sdf)
        
        # Также получаем компоненты для корректного разделения молекул
        _, molecules = _parse_sdf_atoms_and_components(sdf)
        
        models.append(
            {
                "compound": comp,
                "format": "sdf",
                "data": sdf,
                "atoms": atoms,
                "bonds": bonds,
                "molecules": molecules,
                "source": "PubChem",
                "side": side,
            }
        )
    return models

def make_morph_frames(reactant_models, product_models, left_coeffs, right_coeffs, steps=30):
    """Генерирует кадры анимации с глобальным сопоставлением атомов и связей."""
    
    def _flatten_models(models_list, side_start_x, coeffs_map, duplicate=False):
        all_atoms = []
        all_bonds = []
        mol_idx_offset = 0
        
        for m in models_list:
            coeff_val = coeffs_map.get(m["compound"], 1)
            try:
                count = int(coeff_val)
            except:
                count = 1
            
            # Если duplicate=False, рисуем только одну молекулу
            actual_count = count if duplicate else 1
            
            centered_atoms = _center_molecule(m["atoms"])
            
            for c in range(actual_count):
                # Смещаем молекулы, чтобы они не накладывались друг на друга
                # Если их много, выстраиваем в сетку
                shift_x = side_start_x + mol_idx_offset * 8.0
                shift_y = (c % 3) * 4.0 - 4.0 if actual_count > 1 else 0
                shift_z = (c // 3) * 4.0 - 4.0 if actual_count > 1 else 0
                
                atom_global_offset = len(all_atoms)
                for i, a in enumerate(centered_atoms):
                    all_atoms.append({
                        **a,
                        "x": a["x"] + shift_x,
                        "y": a["y"] + shift_y,
                        "z": a["z"] + shift_z,
                        "side": m["side"],
                        "mol_idx": mol_idx_offset,
                        "compound": m["compound"],
                        "label": f"{count}{m['compound']}" if count > 1 else m["compound"],
                        "_orig_idx": atom_global_offset + i
                    })
                
                for b in m.get("bonds", []):
                    all_bonds.append({
                        "start": atom_global_offset + b["start"],
                        "end": atom_global_offset + b["end"],
                        "mol_idx": mol_idx_offset
                    })
                mol_idx_offset += 1
                
        return all_atoms, all_bonds

    # Для мёрфинга используем полное количество молекул (duplicate=True)
    r_atoms, r_bonds = _flatten_models(reactant_models, -7.0, left_coeffs, duplicate=True)
    p_atoms, p_bonds = _flatten_models(product_models, 7.0, right_coeffs, duplicate=True)
    
    # Для статических кадров (первый и последний) создаем версии с одной молекулой
    r_atoms_single, r_bonds_single = _flatten_models(reactant_models, -7.0, left_coeffs, duplicate=False)
    p_atoms_single, p_bonds_single = _flatten_models(product_models, 7.0, right_coeffs, duplicate=False)

    # Сопоставляем атомы глобально
    matched, r_rem, p_rem = _match_atoms(r_atoms, p_atoms)
    
    frames = []
    # Добавляем специальный кадр в начало для режима "Реагенты" (одиночные молекулы)
    # Мы пометим его, чтобы фронтенд знал
    reactant_static_frame = {
        'title': 'Реагенты',
        'atoms': r_atoms_single,
        'bonds': r_bonds_single,
        'progress': 0,
        'is_static': True
    }
    
    product_static_frame = {
        'title': 'Продукты',
        'atoms': p_atoms_single,
        'bonds': p_bonds_single,
        'progress': 1.0,
        'is_static': True
    }

    for step in range(steps + 1):
        t = step / steps
        t_smooth = t * t * (3 - 2 * t)
        
        frame_atoms = []
        r_to_frame = {}
        p_to_frame = {}
        
        # 1. Сопоставленные атомы (движутся и меняют владельца)
        for r_at, p_at in matched:
            idx = len(frame_atoms)
            at = interpolate_coords(r_at, p_at, t_smooth)
            at['opacity'] = 1.0
            # Передаем mol_idx и название соединения в зависимости от прогресса
            at['mol_idx'] = r_at['mol_idx'] if t < 0.5 else p_at['mol_idx']
            at['compound'] = r_at['compound'] if t < 0.5 else p_at['compound']
            at['label'] = r_at.get('label', r_at['compound']) if t < 0.5 else p_at.get('label', p_at['compound'])
            frame_atoms.append(at)
            r_to_frame[r_at["_orig_idx"]] = idx
            p_to_frame[p_at["_orig_idx"]] = idx

        # 2. Лишние реагенты (исчезают)
        for r_at in r_rem:
            idx = len(frame_atoms)
            at = {**r_at}
            at['opacity'] = 1.0 - t_smooth
            at['z'] = r_at['z'] - t_smooth * 3 # Улетают вглубь
            frame_atoms.append(at)
            r_to_frame[r_at["_orig_idx"]] = idx

        # 3. Лишние продукты (появляются)
        for p_at in p_rem:
            idx = len(frame_atoms)
            at = {**p_at}
            at['opacity'] = t_smooth
            at['z'] = p_at['z'] + (1.0 - t_smooth) * 3 # Прилетают из глубины
            frame_atoms.append(at)
            p_to_frame[p_at["_orig_idx"]] = idx
            
        # Сборка связей для текущего кадра
        frame_bonds = []
        # Связи реагентов (исчезают)
        for b in r_bonds:
            if b["start"] in r_to_frame and b["end"] in r_to_frame:
                frame_bonds.append({
                    "start": r_to_frame[b["start"]],
                    "end": r_to_frame[b["end"]],
                    "opacity": 1.0 - t_smooth
                })
        # Связи продуктов (появляются)
        for b in p_bonds:
            if b["start"] in p_to_frame and b["end"] in p_to_frame:
                frame_bonds.append({
                    "start": p_to_frame[b["start"]],
                    "end": p_to_frame[b["end"]],
                    "opacity": t_smooth
                })
                
        frames.append({
            'title': 'Химическая реакция' if 0.1 < t < 0.9 else ('Реагенты' if t <= 0.1 else 'Продукты'),
            'atoms': frame_atoms,
            'bonds': frame_bonds,
            'progress': round(t, 2)
        })
    return frames, reactant_static_frame, product_static_frame


@router.post("/api/simulate-visualize")
async def simulate_visualize(
    reactants: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Поиск SDF для симулятора по названию или формуле и генерация кадров анимации"""
    # Сохраняем в историю только для авторизованных
    if current_user:
        existing = db.query(SearchHistory).filter(
            SearchHistory.user_id == current_user.id,
            SearchHistory.query == reactants,
            SearchHistory.history_type == "simulator"
        ).first()
        
        if existing:
            existing.timestamp = datetime.utcnow()
        else:
            new_history = SearchHistory(
                user_id=current_user.id,
                query=reactants,
                history_type="simulator"
            )
            db.add(new_history)
        db.commit()

    # Нормализация галогенов: если пользователь ввёл Cl, Br, I, F без индекса 2
    # заменяем их на молекулярную форму для корректной реакции
    reactants_normalized = re.sub(r"\b(Cl|Br|I|F|H|O|N)\b(?!\d)", r"\g<1>2", reactants)
    print(f"[simulate-visualize] Input: {reactants}, Normalized: {reactants_normalized}")

    raw_equation = ""
    
    # ПРОВЕРКА ФОЛБЭКА (без Ollama)
    fallback_key = "+".join(sorted(reactants_normalized.upper().replace(" ", "").split("+")))
    if hasattr(sim, 'SIMULATOR_FALLBACKS') and fallback_key in sim.SIMULATOR_FALLBACKS:
        print(f"[simulate-visualize] Using fallback for {reactants_normalized}")
        raw_equation = sim.SIMULATOR_FALLBACKS[fallback_key]
    else:
        try:
            raw_equation = await sim._generate_reaction(reactants_normalized)
            try:
                print(f"[simulate-visualize][ollama_raw]: {raw_equation}")
            except Exception:
                pass
        except Exception as e:
            print(f"[simulate-visualize] Ollama failed: {e}")
            pass

    if not raw_equation:
        raise HTTPException(
            status_code=500,
            detail="Не удалось получить уравнение реакции. Проверьте, что Ollama запущена.",
        )

    # Применяем защитные фильтры для исправления известных ошибок модели
    input_elements = set(re.findall(r"[A-Z][a-z]?", reactants_normalized))
    raw_equation = sim.apply_safety_guards(raw_equation, input_elements)

    # Балансируем и разбираем уравнение с максимально мягким фолбэком
    try:
        balanced = sim.balance_equation(raw_equation)  # type: ignore[attr-defined]
    except Exception as exc:
        balanced = raw_equation
        print(f"[simulate-visualize] balance failed, using raw: {exc}")

    def _fallback_split(eq: str):
        tmp = re.sub(r"[→↔⇒]", "->", eq)
        parts = tmp.split("->")
        if len(parts) >= 2:
            l_raw = parts[0]
            r_raw = "->".join(parts[1:])
            l = [p.strip() for p in l_raw.split("+") if p.strip()]
            r = [p.strip() for p in r_raw.split("+") if p.strip()]
            return l, r, l_raw, r_raw
        return [], [], "", ""

    left = right = []
    left_raw = right_raw = ""
    try:
        left, right = sim._split_equation(balanced)  # type: ignore[attr-defined]
        left_raw, right_raw = re.split(r"->|→", balanced)
        try:
            print(f"[simulate-visualize][balanced]: {balanced}")
        except Exception:
            pass
    except Exception as exc:
        print(f"[simulate-visualize] split failed, fallback: {exc}")
        left, right, left_raw, right_raw = _fallback_split(balanced)

    # если всё ещё пусто — пробуем raw_equation
    if not left or not right:
        left, right, left_raw, right_raw = _fallback_split(raw_equation)
        # Если fallback сработал, пересобираем balanced для фронта
        if left and right:
            balanced = f"{left_raw} → {right_raw}"

    if not left or not right:
        # если совсем ничего не разобрали — вернём сырые строки
        left = [raw_equation] if raw_equation else []
        right = []
        model_error = "Не удалось разобрать уравнение, показано как есть."
    else:
        model_error = None

    info = {
        "реагенты": left,
        "продукты": right,
        "элементов": len({el for comp in left + right for el in sim._parse_formula(comp)}),  # type: ignore[attr-defined]
    }

    # выбираем первую доступную молекулу, для которой найдём SDF
    models = await _collect_models(left, right)
    print(f"[simulate-visualize] Collected {len(models)} models")

    # формируем кадры: реагенты -> переход -> продукты
    reactant_models = [m for m in models if m["side"] == "reactant"]
    product_models = [m for m in models if m["side"] == "product"]

    left_coeffs = _parse_side_coeffs(left_raw)
    right_coeffs = _parse_side_coeffs(right_raw)

    frames = []
    reactant_static = None
    product_static = None
    
    if reactant_models and product_models:
        frames, reactant_static, product_static = make_morph_frames(reactant_models, product_models, left_coeffs, right_coeffs, steps=30)
        print(f"[simulate-visualize] Generated {len(frames)} animation frames")
    else:
        model_error = "Не удалось получить 3D данные из PubChem ни для продуктов, ни для реагентов."

    # Убеждаемся, что уравнение всегда есть
    if not balanced or balanced.strip() == "→":
        balanced = f"{' + '.join(left)} → {' + '.join(right)}" if left and right else raw_equation

    return {
        "reactants": reactants,
        "equation": balanced,
        "raw_equation": raw_equation,
        "info": info,
        "model": models[0] if models else None,
        "model_error": model_error,
        "frames": frames,
        "reactant_static": reactant_static,
        "product_static": product_static,
        "models": models,
    }

@router.get("/api/simulate/history")
async def get_simulator_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Получить историю запросов симулятора (последние 20)"""
    if not current_user:
        return []
    history = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.history_type == "simulator"
    ).order_by(desc(SearchHistory.timestamp)).limit(20).all()
    
    return [{"query": h.query, "timestamp": h.timestamp.isoformat()} for h in history]

@router.get("/api/visualizer/history")
async def get_visualizer_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Получить историю запросов визуализатора (последние 20)"""
    if not current_user:
        return []
    history = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.history_type == "visualizer"
    ).order_by(desc(SearchHistory.timestamp)).limit(20).all()
    
    return [{"query": h.query, "timestamp": h.timestamp.isoformat()} for h in history]

@router.delete("/api/simulate/history/{query}")
async def delete_simulate_history(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить конкретный запрос из истории симулятора"""
    item = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.query == query,
        SearchHistory.history_type == "simulator"
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Запись не найдена")
        
    db.delete(item)
    db.commit()
    return {"status": "deleted"}

