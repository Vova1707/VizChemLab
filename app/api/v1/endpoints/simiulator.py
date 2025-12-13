import re
import httpx
from fastapi import APIRouter, Body, HTTPException
from fractions import Fraction
from math import gcd
from typing import Dict, List, Tuple

router = APIRouter()

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "phi3"


def clean_equation(text: str) -> str:
    """Извлекает уравнение из LaTeX/markdown/текста, упрощённо."""
    import re
    # конвертируем нижние индексы Юникода в цифры
    sub_map = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
    text = text.translate(sub_map)

    # блоки \\[ ... \\] и $...$
    m = re.search(r"\\\[(.+?)\\\]", text, re.S)
    if m:
        text = m.group(1)
    m = re.search(r"\$(.+?)\$", text)
    if m:
        text = m.group(1)
    text = text.replace("\n", " ").replace("\r", " ").strip()
    text = re.sub(r"^[^A-Za-z0-9]+", "", text)
    text = text.replace("→", "->").replace("\\rightarrow", "->").replace("=>", "->")

    # нормализуем пробелы около плюсов
    text = re.sub(r"\s*\+\s*", " + ", text)

    m = re.search(r"([A-Za-z0-9_()]+(?:\s*\+\s*[A-Za-z0-9_()]+)*)\s*->\s*([A-Za-z0-9_()]+(?:\s*\+\s*[A-Za-z0-9_()]+)*)", text)
    if m:
        left, right = m.group(1), m.group(2)
    else:
        # fallback: если стрелку не нашли, возвращаем исходный текст
        return text.strip()

    def _clean(side: str) -> str:
        side = re.sub(r"\((?:g|l|aq|s)\)", "", side)
        side = re.sub(r"\s+", " ", side).strip()
        return side

    left = _clean(left)
    right = _clean(right)
    if not left or not right:
        return text.strip()
    eq = f"{left} → {right}"
    # убираем подчёркивания вида H_2 -> H2
    eq = eq.replace("_", "")
    return eq


def _parse_formula(formula: str) -> Dict[str, int]:
    """Парсим формулу и считаем элементы, поддержка скобок."""
    tokens = re.findall(r"[A-Z][a-z]?|\(|\)|\d+", formula)
    stack: List[Dict[str, int]] = [{}]
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok == "(":
            stack.append({})
            i += 1
        elif tok == ")":
            group = stack.pop()
            i += 1
            mult = 1
            if i < len(tokens) and tokens[i].isdigit():
                mult = int(tokens[i])
                i += 1
            for el, cnt in group.items():
                stack[-1][el] = stack[-1].get(el, 0) + cnt * mult
        elif tok.isdigit():
            # коэффициент относится к предыдущему элементу
            prev = tokens[i - 1]
            if prev in ("(", ")"):
                i += 1
                continue
            el = prev
            mult = int(tok)
            stack[-1][el] = stack[-1].get(el, 0) + (mult - 1)  # 1 уже учли ранее
            i += 1
        else:
            stack[-1][tok] = stack[-1].get(tok, 0) + 1
            i += 1
    return stack[0]


def _strip_leading_coeff(compound: str) -> str:
    """
    Нормализуем ведущий коэффициент, убираем ведущие нули и пробелы.
    Примеры:
    - '02H2' -> 'H2'
    - '2H2' -> 'H2'
    - '019/2 O2' -> 'O2'
    - '0 H2O' -> 'H2O'
    """
    compound = compound.strip()
    # Сначала пробуем с пробелом
    m = re.match(r"^\s*([+-]?)(0*)(\d+)(?:\s*/\s*0*(\d+))?\s+([A-Za-z(].*)$", compound)
    if not m:
        # Потом без пробела (например "2H2")
        m = re.match(r"^\s*([+-]?)(0*)(\d+)(?:\s*/\s*0*(\d+))?([A-Za-z(].*)$", compound)
    if not m:
        return compound

    sign, _, num, denom, rest = m.groups()
    num_int = int(num)
    if denom:
        denom_int = int(denom)
        if denom_int == 0:
            return rest.strip()
        coeff = f"{num_int}/{denom_int}"
    else:
        coeff = str(num_int)

    # Если коэффициент 0 или 1, возвращаем только формулу
    if coeff == "0" or coeff == "1":
        return rest.strip()

    # Для остальных коэффициентов возвращаем формулу без коэффициента
    return rest.strip()


def _split_equation(eq: str) -> Tuple[List[str], List[str]]:
    left_right = re.split(r"->|→", eq)
    if len(left_right) != 2:
        raise ValueError("Некорректное уравнение, нет стрелки.")
    left = [_strip_leading_coeff(c) for c in left_right[0].split("+") if c.strip()]
    right = [_strip_leading_coeff(c) for c in left_right[1].split("+") if c.strip()]
    if not left or not right:
        raise ValueError("Некорректное уравнение, нет реагентов или продуктов.")
    return left, right


def _lcm(a: int, b: int) -> int:
    return abs(a * b) // gcd(a, b)


def _normalize_coeffs(coeffs: List[Fraction]) -> List[int]:
    den_lcm = 1
    for c in coeffs:
        den_lcm = _lcm(den_lcm, c.denominator)
    ints = [int(c * den_lcm) for c in coeffs]
    common = abs(ints[0])
    for v in ints[1:]:
        common = gcd(common, abs(v))
    if common == 0:
        common = 1
    return [v // common for v in ints]


def _nullspace_int(matrix: List[List[int]]) -> List[int]:
    """Ищем целочисленный ненулевой вектор в ядре матрицы."""
    m = len(matrix)
    n = len(matrix[0]) if matrix else 0
    mat = [[Fraction(x) for x in row] for row in matrix]
    row = 0
    pivots: List[int] = []
    for col in range(n):
        pivot_row = None
        for r in range(row, m):
            if mat[r][col] != 0:
                pivot_row = r
                break
        if pivot_row is None:
            continue
        mat[row], mat[pivot_row] = mat[pivot_row], mat[row]
        pivot = mat[row][col]
        mat[row] = [v / pivot for v in mat[row]]
        for r in range(m):
            if r != row and mat[r][col] != 0:
                factor = mat[r][col]
                mat[r] = [mat[r][c] - factor * mat[row][c] for c in range(n)]
        pivots.append(col)
        row += 1
        if row == m:
            break

    free_cols = [c for c in range(n) if c not in pivots]
    if not free_cols:
        # квадратная полная ранга -> берём последнее как свободную
        free_cols = [n - 1]
    free = free_cols[0]
    solution = [Fraction(0) for _ in range(n)]
    solution[free] = Fraction(1)

    for r in reversed(range(len(pivots))):
        col = pivots[r]
        val = -sum(mat[r][c] * solution[c] for c in range(col + 1, n))
        solution[col] = val / mat[r][col] if mat[r][col] != 0 else 0

    return _normalize_coeffs(solution)


def balance_equation(eq: str) -> str:
    """Балансировка с помощью линейной алгебры над дробями."""
    left, right = _split_equation(eq)
    compounds = left + right
    elements = sorted({el for comp in compounds for el in _parse_formula(comp)})

    matrix: List[List[int]] = []
    for el in elements:
        row = []
        for comp in left:
            row.append(_parse_formula(comp).get(el, 0))
        for comp in right:
            row.append(-_parse_formula(comp).get(el, 0))
        matrix.append(row)

    coeffs = _nullspace_int(matrix)
    left_coeffs = coeffs[: len(left)]
    right_coeffs = coeffs[len(left) :]

    def fmt(coeff: int, formula: str) -> str:
        # не выводим компонент с нулевым коэффициентом
        if coeff <= 0:
            return ''
        s = f"{coeff}" if coeff != 1 else ""
        return f"{s}{formula}"

    left_part = ' + '.join(x for x in (fmt(c, f) for c, f in zip(left_coeffs, left)) if x)
    right_part = ' + '.join(x for x in (fmt(abs(c), f) for c, f in zip(right_coeffs, right)) if x)
    return f"{left_part} → {right_part}"

async def _generate_reaction(reactants: str) -> str:
    prompt = (
        f"Reactants: {reactants}\n"
        "Write the balanced chemical equation.\n"
        "Example: 2H2 + O2 → 2H2O\n"
        "Answer (only equation, no text):"
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 80},
                },
            )
            response.raise_for_status()
            raw = response.json().get("response", "")
            try:
                print(f"[ollama][raw]: {raw}")
            except Exception:
                pass
            cleaned = clean_equation(raw)
            try:
                print(f"[ollama][cleaned]: {cleaned}")
            except Exception:
                pass
            return cleaned
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка ответа модели: {exc.response.text}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Сервис модели недоступен: {exc}",
        ) from exc


@router.post("/api/simulate")
async def simulate_reaction(reactants: str = Body(..., embed=True)):
    """
    Генерируем уравнение реакции по введённым реагентам через локальную Ollama (phi3).
    Ожидается строка вида: "H2 + O2" или "NaCl + AgNO3".
    """
    reactants = reactants.strip()
    if not reactants:
        raise HTTPException(status_code=400, detail="Реагенты не переданы")

    raw_equation = await _generate_reaction(reactants)
    if not raw_equation:
        raise HTTPException(
            status_code=500,
            detail="Не удалось получить уравнение реакции от модели",
        )

    try:
        balanced = balance_equation(raw_equation)
    except Exception as exc:
        # если не получилось уравнять, возвращаем как есть
        balanced = raw_equation
        print(f"[simulate] Не удалось уравнять '{raw_equation}': {exc}")

    left, right = _split_equation(balanced)

    info = {
        "реагенты": left,
        "продукты": right,
        "элементов": len({el for comp in left + right for el in _parse_formula(comp)}),
    }

    return {
        "reactants": reactants,
        "equation": balanced,
        "raw_equation": raw_equation,
        "info": info,
    }

