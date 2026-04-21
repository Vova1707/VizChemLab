import re
import httpx
import uuid
from fastapi import APIRouter, Body, HTTPException
from fractions import Fraction
from math import gcd
from typing import Dict, List, Tuple, Optional
from pydantic import BaseModel
from core.config import settings
import time

class SimulateRequest(BaseModel):
    reactants: str
    
class ReactantProduct(BaseModel):
    formula: str
    
class ReactionInfo(BaseModel):
    реагенты: List[str]
    продукты: List[str]
    элементов: int
    
class SimulateResponse(BaseModel):
    reactants: str
    equation: str
    raw_equation: str
    info: ReactionInfo

router = APIRouter()

# GigaChat API endpoints
GIGACHAT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_COMPLETIONS_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

# Global variables to store access token and its expiry
_gigachat_token: Optional[str] = None
_gigachat_token_expiry: Optional[float] = None

async def get_gigachat_token() -> str:
    """Получает или обновляет токен GigaChat API с автообновлением."""
    global _gigachat_token, _gigachat_token_expiry
    
    current_time = time.time()
    
    # Если токен есть и не истек (30 минут - 1800 секунд), используем его
    if _gigachat_token and _gigachat_token_expiry and current_time < _gigachat_token_expiry:
        return _gigachat_token
    
    print("Getting new GigaChat token...")

    # Правильные заголовки согласно документации GigaChat
    auth_key = settings.GIGACHAT_AUTH_KEY.get_secret_value().strip()
    headers = {
        'Authorization': f'Basic {auth_key}',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': '99c62694-10a5-4f6f-8d2d-5759431d8f22'  # Обязательный UUID
    }
    
    # Правильный payload
    payload = 'scope=GIGACHAT_API_PERS'
    
    try:
        print(f"GigaChat auth request")
        print(f"URL: {GIGACHAT_AUTH_URL}")
        print(f"Headers: {headers}")
        print(f"Payload: {payload}")
        
        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.post(GIGACHAT_AUTH_URL, headers=headers, content=payload)
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                _gigachat_token = data.get("access_token")
                expires_in = data.get("expires_in", 1800)  # по умолчанию 30 минут
                
                if _gigachat_token:
                    # Устанавливаем время истечения за 5 минут до реального, для перестраховки
                    _gigachat_token_expiry = current_time + expires_in - 300
                    print(f"SUCCESS! Token received, expires in {expires_in}s")
                    return _gigachat_token
                else:
                    print("No access_token in response")
                    raise HTTPException(status_code=500, detail="No access token in GigaChat response")
            else:
                print(f"GigaChat auth failed: {response.status_code}")
                print(f"Error details: {response.text}")
                raise HTTPException(status_code=500, detail=f"GigaChat Auth Error: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"GigaChat token error: {e}")
        raise HTTPException(status_code=500, detail=f"GigaChat Auth Error: {str(e)}")

SIMULATOR_FALLBACKS = {
    "H2+O2": "2H2 + O2 → 2H2O",
    "CL2+H2": "H2 + Cl2 → 2HCl",
    "CL2+O2": "2Cl2 + O2 → 2Cl2O",
    "H2+N2": "N2 + 3H2 → 2NH3",
    "CH4+O2": "CH4 + 2O2 → CO2 + 2H2O",
    "CL2+NA": "2Na + Cl2 → 2NaCl",
    "FE+O2": "4Fe + 3O2 → 2Fe2O3",
}

def clean_equation(text: str) -> str:
    """Извлекает уравнение из LaTeX/markdown/текста, упрощённо."""
    sub_map = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
    text = text.translate(sub_map)

    m = re.search(r"\\\[(.+?)\\\]", text, re.S)
    if m:
        text = m.group(1)
    m = re.search(r"\$(.+?)\$", text)
    if m:
        text = m.group(1)
    text = text.replace("\n", " ").replace("\r", " ").strip()
    text = re.sub(r"^[^A-Za-z0-9]+", "", text)
    text = text.replace("→", "->").replace("\\rightarrow", "->").replace("=>", "->")

    text = re.sub(r"\s*\+\s*", " + ", text)

    m = re.search(r"([A-Za-z0-9_()]+(?:\s*\+\s*[A-Za-z0-9_()]+)*)\s*->\s*([A-Za-z0-9_()]+(?:\s*\+\s*[A-Za-z0-9_()]+)*)", text)
    if m:
        left, right = m.group(1), m.group(2)
    else:
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
    eq = eq.replace("_", "")
    return eq


def _parse_formula(formula: str) -> Dict[str, int]:
    """Парсим формулу и считаем элементы"""
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
        
            prev = tokens[i - 1]
            if prev in ("(", ")"):
                i += 1
                continue
            el = prev
            mult = int(tok)
            stack[-1][el] = stack[-1].get(el, 0) + (mult - 1)
            i += 1
        else:
            stack[-1][tok] = stack[-1].get(tok, 0) + 1
            i += 1
    return stack[0]


def _strip_leading_coeff(compound: str) -> str:
    """
    Нормализуем ведущий коэффициент, убираем ведущие нули и пробелы.
    """
    compound = compound.strip()
    m = re.match(r"^\s*([+-]?)(0*)(\d+)(?:\s*/\s*0*(\d+))?\s+([A-Za-z(].*)$", compound)
    if not m:
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

    if coeff == "0" or coeff == "1":
        return rest.strip()
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
        if coeff <= 0:
            return ''
        s = f"{coeff}" if coeff != 1 else ""
        return f"{s}{formula}"

    left_part = ' + '.join(x for x in (fmt(c, f) for c, f in zip(left_coeffs, left)) if x)
    right_part = ' + '.join(x for x in (fmt(abs(c), f) for c, f in zip(right_coeffs, right)) if x)
    return f"{left_part} → {right_part}"

async def _generate_reaction(reactants: str) -> str:
    print(f"DEBUG: Generating reaction for: {reactants}")
    prompt = (
        "You are an expert organic and inorganic chemist.\n"
        f"Request: {reactants}\n"
        "Instructions:\n"
        "1. Analyze the reactants and determine the most likely chemical reaction (substitution, addition, elimination, dehydration, combustion, etc.).\n"
        "2. For organic reactions, use standard IUPAC products (e.g., ethanol dehydration -> C2H4 + H2O).\n"
        "3. Ensure all diatomic molecules are in their natural state (O2, H2, Cl2, Br2, N2, F2, I2).\n"
        "4. If conditions are implied (e.g., 'дегидратация'), produce the corresponding elimination products.\n"
        "5. If no reaction is possible between the given reactants, output ONLY the string 'NO_REACTION'.\n"
        "6. Output ONLY the balanced chemical equation. No explanations, no markdown.\n"
        "Examples:\n"
        "- C2H5OH -> C2H4 + H2O\n"
        "- CH4 + Cl2 -> CH3Cl + HCl\n"
        "- C4H8 + Br2 -> C4H8Br2\n"
        "- горение водорода -> 2H2 + O2 → 2H2O\n"
        "- He + Ne -> NO_REACTION\n"
        "Balanced Equation:"
    )
    try:
        token = await get_gigachat_token()
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        payload = {
            "model": "GigaChat",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert organic and inorganic chemist."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.1,
            "top_p": 0.1,
            "n": 1,
            "stream": False,
            "max_tokens": 100,
            "repetition_penalty": 1
        }

        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            response = await client.post(
                GIGACHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            cleaned = clean_equation(raw)
            return cleaned
    except httpx.HTTPStatusError as exc:
        # Если токен протух, сбрасываем его
        if exc.response.status_code == 401:
            global _gigachat_token, _gigachat_token_expiry
            _gigachat_token = None
            _gigachat_token_expiry = None
        print(f"GigaChat API Error: {exc.response.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка ответа GigaChat API: {exc.response.text}",
        ) from exc
    except httpx.RequestError as exc:
        print(f"GigaChat Request Error: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"GigaChat API недоступен: {exc}",
        ) from exc


def apply_safety_guards(raw_equation: str, input_elements: set) -> str:
    """Применяет исправления для известных галлюцинаций модели."""
    # 1. Защита от галлюцинации CO2
    if "H" in input_elements and "O" in input_elements and "C" not in input_elements:
        output_elements = set(re.findall(r"[A-Z][a-z]?", raw_equation))
        if "C" in output_elements and "CO2" in raw_equation:
            return "2H2 + O2 → 2H2O"

    # 2. Защита от галлюцинации серы: S2 + O2
    if "S" in input_elements and "O" in input_elements and "C" not in input_elements:
        if "S8" in raw_equation and "O2" in input_elements:
            return "S2 + 2O2 → 2SO2"
            
    # 3. Защита от галлюцинации алюминия: Al4C3 + H2O
    if "Al" in input_elements and "C" in input_elements:
        if ("Al(OH)3" in raw_equation or "CH4" in raw_equation) and "H2O" in raw_equation:
            return "Al4C3 + H2O → Al(OH)3 + CH4"
    if "H" in input_elements and "Cl" in input_elements and len(input_elements) == 2:
        if "HCl" not in raw_equation:
            return "H2 + Cl2 → 2HCl"

    return raw_equation


@router.post("/api/simulate",
              response_model=SimulateResponse,
              summary="Симуляция химической реакции",
              description="Генерирует уравнение химической реакции по введенным реагентам с помощью GigaChat AI. Автоматически нормализует галогены и балансирует уравнение.",
              responses={
                  200: {"description": "Реакция успешно смоделирована"},
                  400: {"description": "Некорректные реагенты"},
                  500: {"description": "Ошибка при генерации реакции"}
              })
async def simulate_reaction(reactants: str = Body(..., examples={"example": {"value": "H2 + O2"}}, description="Реагенты для симуляции реакции")):
    reactants = reactants.strip()
    if not reactants:
        raise HTTPException(status_code=400, detail="Реагенты не переданы")

    reactants = re.sub(r"\b(Cl|Br|I|F|H|O|N)\b(?!\d)", r"\g<1>2", reactants)

    fallback_key = "+".join(sorted(reactants.upper().replace(" ", "").split("+")))
    if fallback_key in SIMULATOR_FALLBACKS:
        raw_equation = SIMULATOR_FALLBACKS[fallback_key]
    else:
        try:
            raw_equation = await _generate_reaction(reactants)
        except HTTPException as e:
            raise e
        except Exception:
            raise HTTPException(status_code=500, detail="Ошибка при генерации реакции")

    if not raw_equation:
        raise HTTPException(
            status_code=500,
            detail="Не удалось получить уравнение реакции. Проверьте подключение к GigaChat API.",
        )

    input_elements = set(re.findall(r"[A-Z][a-z]?", reactants))
    raw_equation = apply_safety_guards(raw_equation, input_elements)

    output_elements = set(re.findall(r"[A-Z][a-z]?", raw_equation))
    hallucinated = output_elements - input_elements
    if hallucinated:
        pass

    try:
        balanced = balance_equation(raw_equation)
    except Exception:
        balanced = raw_equation

    left, right = _split_equation(balanced)

    info = ReactionInfo(
        реагенты=left,
        продукты=right,
        элементов=len({el for comp in left + right for el in _parse_formula(comp)}),
    )

    return SimulateResponse(
        reactants=reactants,
        equation=balanced,
        raw_equation=raw_equation,
        info=info,
    )
