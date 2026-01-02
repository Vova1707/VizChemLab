import httpx
from urllib.parse import quote
import asyncio

MYMEMORY_URL = "https://api.mymemory.translated.net/get"

async def _translate_to_ru(text: str) -> str:
    """Перевод названия на русский язык через MyMemory API."""
    if not text or text.startswith("Compound"):
        return text
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                MYMEMORY_URL,
                params={"q": text, "langpair": "en|ru"},
            )
            if r.status_code == 200:
                data = r.json()
                translated = data.get("responseData", {}).get("translatedText")
                if translated:
                    return translated.lower().strip()
    except Exception:
        pass
    return text

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
                    return translated
    except Exception:
        pass
    return None

async def fetch_name_by_formula(formula: str) -> str | None:
    """Получить IUPAC название по формуле."""
    cids = await fetch_cids_by_formula(formula)
    if not cids:
        return None
    
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cids[0]}/property/IUPACName/JSON"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                name = data.get("PropertyTable", {}).get("Properties", [{}])[0].get("IUPACName")
                return name
    except Exception:
        pass
    return None

async def fetch_pubchem_sdf_by_name(query: str, record_type: str = "3d") -> str | None:
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(query)}/SDF"
    params = {"record_type": record_type}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        if r.status_code == 200 and r.text.strip():
            return r.text
    return None

async def fetch_pubchem_sdf_by_cid(cid: int, record_type: str = "3d") -> str | None:
    """Получить SDF по CID"""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF"
    params = {"record_type": record_type}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        if r.status_code == 200 and r.text.strip():
            return r.text
    return None

async def fetch_cids_by_formula(formula: str) -> list[int]:
    """Поиск CID по химической формуле. Пробуем fastformula, затем обычный поиск."""
    # 1. Пробуем fastformula (быстрее)
    fast_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/{quote(formula)}/cids/JSON?MaxRecords=40"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(fast_url)
            if r.status_code == 200:
                data = r.json()
                cids = data.get("IdentifierList", {}).get("CID", [])
                if cids:
                    return cids
    except Exception as e:
        # В оригинальном коде нет logger, но в инструкции по замене он использовался.
        # Сохраняем структуру замены, но убираем обращения к несуществующему logger или оставляем pass,
        # если logger не импортирован. Однако, следуя логике исправления блока:
        pass

    # 2. Если не нашли, пробуем обычный поиск по формуле
    formula_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/{quote(formula)}/cids/JSON?MaxRecords=40"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(formula_url)
            if r.status_code == 200:
                data = r.json()
                return data.get("IdentifierList", {}).get("CID", [])
    except Exception as e:
        pass

    return []

async def fetch_pubchem_sdf_by_formula(formula: str, record_type: str = "3d") -> str | None:
    """Получить SDF по формуле через CID (более надежный способ)"""
    cids = await fetch_cids_by_formula(formula)
    if not cids:
        return None
    
    # Пытаемся получить 3D для первого CID
    sdf = await fetch_pubchem_sdf_by_cid(cids[0], record_type=record_type)
    if sdf:
        return sdf
        
    # Если 3D не нашли и просили 3D, пробуем 2D как запасной вариант
    if record_type == "3d":
        return await fetch_pubchem_sdf_by_cid(cids[0], record_type="2d")
        
    return None

async def fetch_compound_names(cids: list[int]) -> list[dict]:
    """Получить названия для списка CID и перевести их."""
    if not cids:
        return []
    
    cids_subset = cids[:40]
    cids_str = ",".join(map(str, cids_subset))
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cids_str}/property/IUPACName,PreferredName,Title/JSON"
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                properties = data.get("PropertyTable", {}).get("Properties", [])
                
                results_temp = []
                translate_tasks = []
                
                for prop in properties:
                    cid = prop.get("CID")
                    name_en = prop.get("Title") or prop.get("IUPACName") or prop.get("PreferredName") or f"CID {cid}"
                    results_temp.append({"cid": cid, "name_en": name_en})
                    translate_tasks.append(_translate_to_ru(name_en))
                
                translated_names = await asyncio.gather(*translate_tasks)
                
                final_results = []
                for i, item in enumerate(results_temp):
                    name = translated_names[i]
                    is_technical = any(x in name.lower() for x in ["cid", "compound", "соединение", "изомер"])
                    is_just_numbers = name.strip().isdigit()
                    
                    if is_technical or is_just_numbers:
                        name = f"изомер {i + 1}"
                    
                    final_results.append({
                        "cid": item["cid"],
                        "name": name
                    })
                return final_results
    except Exception:
        pass
    return [{"cid": cid, "name": f"изомер {i + 1}"} for i, cid in enumerate(cids_subset)]

async def get_sdf_any(compound: str) -> str | None:
    """Универсальный поиск SDF по названию или формуле"""
    trans = await _maybe_translate_to_en(compound)
    query = trans or compound
    
    # 1. Пробуем как название (3D, затем 2D)
    for rt in ["3d", "2d"]:
        sdf = await fetch_pubchem_sdf_by_name(query, record_type=rt)
        if sdf:
            return sdf
            
    # 2. Пробуем как формулу (3D, затем 2D)
    for rt in ["3d", "2d"]:
        sdf = await fetch_pubchem_sdf_by_formula(query, record_type=rt)
        if sdf:
            return sdf
            
    return None
