import httpx
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from urllib.parse import quote

router = APIRouter()

LIBRETRANSLATE_URL = "https://libretranslate.com/translate"
MYMEMORY_URL = "https://api.mymemory.translated.net/get"

async def _maybe_translate_to_en(text: str) -> str | None:
    """Проверяем, содержит ли строка кириллицу, если да, то пытаемся перевести на английский."""
    if not any("а" <= ch <= "я" or "А" <= ch <= "Я" for ch in text):
        return None

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                MYMEMORY_URL,
                params={"q": text, "langpair": "ru|en"},
            )
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
    """Получить SDF по формуле"""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/{quote(formula)}/SDF"
    params = {"record_type": record_type}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        if r.status_code == 200 and r.text.strip():
            return r.text
    return None


async def _get_sdf_any(compound: str) -> str | None:
    queries = []
    trans = await _maybe_translate_to_en(compound)
    if trans:
        queries.append(trans)
    queries.append(compound)
    for q in queries:
        for record_type in ("3d", "2d"):
            sdf = await _fetch_pubchem_sdf_by_name(q, record_type=record_type)
            if sdf:
                return sdf
            sdf = await _fetch_pubchem_sdf_by_formula(q, record_type=record_type)
            if sdf:
                return sdf
    return None


@router.post("/api/visualize")
async def visualize_compound(compound: str = Body(..., embed=True)):
    sdf = await _get_sdf_any(compound)
    if not sdf or not sdf.strip():
        return JSONResponse(
            {"error": f"Не удалось получить данные из PubChem: {compound}"},
            status_code=404,
        )
    
    # Проверяем, что SDF содержит хотя бы минимальные данные
    if len(sdf.strip()) < 50:
        return JSONResponse(
            {"error": f"Получены некорректные данные из PubChem: {compound}"},
            status_code=404,
        )

    return {
        "compound": compound,
        "source": "PubChem",
        "format": "sdf",
        "data": sdf,
        "hint": "Фронт может конвертировать SDF в 3D-модель.",
    }


