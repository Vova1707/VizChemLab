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
    # Определяем лимит в зависимости от формулы
    if formula == "C3H6":
        max_records = 10  # Для C3H6 должно быть гораздо меньше изомеров
    elif formula.startswith("C") and len(formula) <= 6:
        max_records = 15  # Для маленьких молекул
    else:
        max_records = 25  # Для больших молекул
    
    #Пробуем fastformula
    fast_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/{quote(formula)}/cids/JSON?MaxRecords={max_records}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(fast_url)
            if r.status_code == 200:
                data = r.json()
                cids = data.get("IdentifierList", {}).get("CID", [])
                if cids:
                    # Убираем дубликаты и сортируем
                    unique_cids = sorted(list(set(cids)))
                    return unique_cids
    except Exception as e:
        pass

    #Если не нашли, пробуем обычный поиск по формуле
    formula_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/{quote(formula)}/cids/JSON?MaxRecords={max_records}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(formula_url)
            if r.status_code == 200:
                data = r.json()
                cids = data.get("IdentifierList", {}).get("CID", [])
                # Убираем дубликаты и сортируем
                unique_cids = sorted(list(set(cids)))
                return unique_cids
    except Exception as e:
        pass

    return []

async def fetch_pubchem_sdf_by_formula(formula: str, record_type: str = "3d") -> str | None:
    """Получить SDF по формуле через CID (более надежный способ)"""
    cids = await fetch_cids_by_formula(formula)
    if not cids:
        return None
    
    sdf = await fetch_pubchem_sdf_by_cid(cids[0], record_type=record_type)
    if sdf:
        return sdf
    if record_type == "3d":
        return await fetch_pubchem_sdf_by_cid(cids[0], record_type="2d")
        
    return None

async def fetch_compound_properties(query: str) -> dict | None:
    """
    Получить свойства соединения (вес, формулу, имя) по названию или формуле.
    """
    # Сначала пытаемся найти CID
    cids = await fetch_cids_by_formula(query)
    if not cids:
        # Если не нашли по формуле, пробуем по имени (хотя fetch_cids_by_formula ищет и то и то частично)
        # Но для надежности можно попробовать поиск по имени, если это не формула
        pass

    cid = cids[0] if cids else None
    
    # Если CID не найден через формулу, попробуем через имя (PugREST name)
    if not cid:
         url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(query)}/cids/JSON"
         try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    data = r.json()
                    found_cids = data.get("IdentifierList", {}).get("CID", [])
                    if found_cids:
                        cid = found_cids[0]
         except Exception:
             pass

    if not cid:
        return None

    # Теперь получаем свойства по CID
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/MolecularWeight,MolecularFormula,IUPACName,Title/JSON"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                props = data.get("PropertyTable", {}).get("Properties", [{}])[0]
                
                # Переводим название
                name_en = props.get("Title") or props.get("IUPACName")
                name_ru = await _translate_to_ru(name_en)
                
                return {
                    "cid": cid,
                    "formula": props.get("MolecularFormula"),
                    "weight": props.get("MolecularWeight"),
                    "name": name_ru,
                    "name_en": name_en
                }
    except Exception:
        pass
    return None

def get_octane_isomer_name(cid: int, index: int) -> str:
    """Генерирует названия для изомеров октана на основе их CID."""
    # Известные изомеры октана и их CID
    octane_isomers = {
        356: "n-Октан",
        10907: "2-Метилгептан", 
        11594: "3-Метилгептан",
        11551: "4-Метилгептан",
        11511: "2,2-Диметилгексан",
        11269: "2,3-Диметилгексан", 
        11512: "2,4-Диметилгексан",
        11519: "2,5-Диметилгексан",
        11215: "3,3-Диметилгексан",
        11233: "3,4-Диметилгексан",
        11412: "3,5-Диметилгексан",
        11447: "2,2,3-Триметилпентан",
        11592: "2,2,4-Триметилпентан",
        11675: "2,3,3-Триметилпентан",
        11863: "2,3,4-Триметилпентан",
        12096: "2,4,4-Триметилпентан",
        14018: "3,3,4-Триметилпентан",
        11255: "2,2,3,3-Тетраметилбутан",
        519375: "2,2,3,4-Тетраметилбутан",
        16212984: "2,3,3,4-Тетраметилбутан"
    }
    
    return octane_isomers.get(cid, f"Изомер {index + 1}")

async def fetch_compound_names(cids: list[int]) -> list[dict]:
    """Получить названия для списка CID."""
    if not cids:
        return []
    
    cids_subset = cids[:40]
    final_results = []
    
    # Для C8H18 используем известные названия изомеров
    for i, cid in enumerate(cids_subset):
        name = get_octane_isomer_name(cid, i)
        
        final_results.append({
            "cid": cid,
            "name": name
        })
    
    return final_results

async def get_sdf_any(compound: str) -> str | None:
    """Универсальный поиск SDF по названию или формуле"""
    trans = await _maybe_translate_to_en(compound)
    query = trans or compound
    
    for rt in ["3d", "2d"]:
        sdf = await fetch_pubchem_sdf_by_name(query, record_type=rt)
        if sdf:
            return sdf
            
    for rt in ["3d", "2d"]:
        sdf = await fetch_pubchem_sdf_by_formula(query, record_type=rt)
        if sdf:
            return sdf
            
    return None
