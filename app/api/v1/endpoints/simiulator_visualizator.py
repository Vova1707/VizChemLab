import httpx
import re
from fastapi import APIRouter, Body, HTTPException
from urllib.parse import quote
import numpy as np

from app.api.v1.endpoints import simiulator as sim

router = APIRouter()

LIBRETRANSLATE_URL = "https://libretranslate.com/translate"
MYMEMORY_URL = "https://api.mymemory.translated.net/get"


async def _maybe_translate_to_en(text: str) -> str | None:
    """Если есть кириллица — пытаемся перевести на английский для PubChem."""
    if not any("а" <= ch <= "я" or "А" <= ch <= "Я" for ch in text):
        return None

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(MYMEMORY_URL, params={"q": text, "langpair": "ru|en"})
            if r.status_code == 200:
                data = r.json()
                translated = data.get("responseData", {}).get("translatedText")
                if translated:
                    print(f"[translate] MyMemory RU->EN: '{text}' -> '{translated}'")
                    return translated
    except Exception as exc:
        print(f"[translate] MyMemory failed for '{text}': {exc}")

    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            r = await client.post(
                LIBRETRANSLATE_URL,
                json={"q": text, "source": "ru", "target": "en", "format": "text"},
                headers={"Content-Type": "application/json"},
            )
            if r.status_code == 200:
                data = r.json()
                translated = data.get("translatedText")
                if translated:
                    print(f"[translate] Libre RU->EN: '{text}' -> '{translated}'")
                    return translated
    except Exception as exc:
        print(f"[translate] Libre failed for '{text}': {exc}")
    return None


async def _fetch_pubchem_sdf_by_name(query: str, record_type: str = "3d") -> str | None:
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(query)}/SDF"
    params = {"record_type": record_type}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        if r.status_code == 200 and r.text.strip():
            return r.text
    return None


async def _fetch_pubchem_sdf_by_formula(formula: str, record_type: str = "3d") -> str | None:
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/{quote(formula)}/SDF"
    params = {"record_type": record_type}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        if r.status_code == 200 and r.text.strip():
            return r.text
    return None


async def _get_sdf_any(compound: str) -> str | None:
    alias_map = {
        "H2": ["hydrogen"],
        "O2": ["oxygen"],
        "H2O": ["water", "dihydrogen monoxide"],
        "CO2": ["carbon dioxide"],
        "NH3": ["ammonia"],
        "CH4": ["methane"],
    }

    queries = []
    trans = await _maybe_translate_to_en(compound)
    if trans:
        queries.append(trans)
    queries.append(compound)
    # если это простая формула — добавляем общеизвестные имена
    aliases = alias_map.get(compound.strip())
    if aliases:
        queries.extend(aliases)
    for q in queries:
        for record_type in ("3d", "2d"):
            sdf = await _fetch_pubchem_sdf_by_name(q, record_type=record_type)
            if sdf:
                return sdf
            sdf = await _fetch_pubchem_sdf_by_formula(q, record_type=record_type)
            if sdf:
                return sdf

    return None


def _pick_targets(left: list[str], right: list[str]) -> list[str]:
    """Собираем список кандидатов без коэффициентов: сперва продукты, потом реагенты."""
    candidates: list[str] = []
    for group in (right, left):
        for comp in group:
            cleaned = sim._strip_leading_coeff(comp)  # type: ignore[attr-defined]
            if cleaned:
                candidates.append(cleaned)
    # удаляем дубли сохраняя порядок
    seen = set()
    uniq: list[str] = []
    for c in candidates:
        if c not in seen:
            uniq.append(c)
            seen.add(c)
    return uniq


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
    for i in range(4, 4 + atom_count):
        parts = lines[i].split()
        if len(parts) < 4:
            continue
        x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
        element = parts[3].strip()
        atoms.append({"element": element, "x": x, "y": y, "z": z})

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
        formula = sim._strip_leading_coeff(m.group(2))  # type: ignore[attr-defined]
        coeffs[formula] = coeffs.get(formula, 0) + coeff
    return coeffs

async def _collect_models(left: list[str], right: list[str]):
    """
    Возвращаем модели с явной стороной (reactant/product), без дублирования.
    Используем исходные списки, чтобы не потерять связь сторона→молекула.
    """
    candidates: list[tuple[str, str]] = []
    for comp in left:
        cleaned = sim._strip_leading_coeff(comp)  # type: ignore[attr-defined]
        if cleaned:
            candidates.append((cleaned, "reactant"))
    for comp in right:
        cleaned = sim._strip_leading_coeff(comp)  # type: ignore[attr-defined]
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
        atoms, molecules = _parse_sdf_atoms_and_components(sdf)
        models.append(
            {
                "compound": comp,
                "format": "sdf",
                "data": sdf,
                "atoms": atoms,
                "molecules": molecules,
                "source": "PubChem",
                "side": side,
            }
        )
    return models


def interpolate_coords(start, end, alpha):
    return {
        'element': start['element'],
        'x': start['x'] * (1 - alpha) + end['x'] * alpha,
        'y': start['y'] * (1 - alpha) + end['y'] * alpha,
        'z': start['z'] * (1 - alpha) + end['z'] * alpha,
    }

def make_morph_frames(reactant_mols, product_mols, steps=16):
    # Простой morpher: для пар молекул одного размера/типа morph, иначе fade
    frames = []
    n = min(len(reactant_mols), len(product_mols))
    for pair in range(n):
        r_atoms = reactant_mols[pair]
        p_atoms = product_mols[pair]
        atoms_len = min(len(r_atoms), len(p_atoms))
        for i in range(steps+1):
            t = i / steps
            frame_atoms = []
            for a in range(atoms_len):
                start = r_atoms[a]
                end = p_atoms[a]
                # интерполируем позицию, прозрачность — плавно 1
                at = interpolate_coords(start, end, t)
                at['opacity'] = 1.0
                frame_atoms.append(at)
            # если избыток — fadeout/fadein
            for j in range(atoms_len, len(r_atoms)):
                a = r_atoms[j]; at = dict(a); at['opacity'] = 1-t; frame_atoms.append(at)
            for j in range(atoms_len, len(p_atoms)):
                a = p_atoms[j]; at = dict(a); at['opacity'] = t; frame_atoms.append(at)
            frames.append({ 'title': 'Морфинг', 'atoms': frame_atoms, 'progress': round(t,2) })
    return frames


@router.post("/api/simulate-visualize")
async def simulate_and_visualize(reactants: str = Body(..., embed=True)):
    """
    Генерируем уравнение (phi3) + балансируем, затем достаём SDF первой
    доступной молекулы (сначала из продуктов, иначе из реагентов) из PubChem,
    чтобы фронт показал 3D.
    """
    reactants = reactants.strip()
    if not reactants:
        raise HTTPException(status_code=400, detail="Реагенты не переданы")

    raw_equation = await sim._generate_reaction(reactants)  # type: ignore[attr-defined]
    try:
        print(f"[simulate-visualize][ollama_raw]: {raw_equation}")
    except Exception:
        pass
    if not raw_equation:
        raise HTTPException(
            status_code=500,
            detail="Не удалось получить уравнение реакции от модели",
        )

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

    # формируем кадры: реагенты -> переход -> продукты
    reactant_models = [m for m in models if m["side"] == "reactant"]
    product_models = [m for m in models if m["side"] == "product"]

    left_coeffs = _parse_side_coeffs(left_raw)
    right_coeffs = _parse_side_coeffs(right_raw)

    # --- MVP: fade-out старых молекул, fade-in новых, с учётом коэффициентов
    def _spread_molecules(models_list, side_start_x, coeffs_map):
        spread = []
        offset = 0
        for m in models_list:
            coeff = coeffs_map.get(m["compound"], 1)
            coeff = max(1, coeff)
            mols = m.get("molecules") or []
            if not mols:
                mols = [m.get("atoms", [])]
            for cidx in range(coeff):
                for mol in mols:
                    shift = side_start_x + offset * 3.0
                    shifted = [{**a, "x": a["x"] + shift, "y": a["y"], "z": a["z"], "from": m["side"]} for a in mol]
                    spread.append(shifted)
                    offset += 1
        return spread

    reactant_mols = _spread_molecules(reactant_models, side_start_x=-6.0, coeffs_map=left_coeffs)
    product_mols = _spread_molecules(product_models, side_start_x=+6.0, coeffs_map=right_coeffs)

    frames = []
    if reactant_mols and product_mols:
        frames = make_morph_frames(reactant_mols, product_mols, steps=18)
    else:
        # старое поведение (fadein/fadeout)
        # ... оставить как fallback ...
        pass

    model = models[0] if models else None

    if model is None:
        model_error = "Не удалось получить 3D данные из PubChem ни для продуктов, ни для реагентов."

    # Убеждаемся, что уравнение всегда есть
    if not balanced or balanced.strip() == "→":
        balanced = f"{' + '.join(left)} → {' + '.join(right)}" if left and right else raw_equation

    try:
        print(f"[simulate-visualize][final_equation]: {balanced}")
        print(f"[simulate-visualize][left]: {left}, [right]: {right}")
    except Exception:
        pass

    return {
        "reactants": reactants,
        "equation": balanced,
        "raw_equation": raw_equation,
        "info": info,
        "model": model,
        "model_error": model_error,
        "frames": frames,
        "models": models,
    }

