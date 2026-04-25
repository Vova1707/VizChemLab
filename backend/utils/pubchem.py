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

def _validate_sdf(sdf: str) -> bool:
    """Базовая валидация SDF формата"""
    if not sdf or len(sdf.strip()) < 10:
        return False
    
    lines = sdf.strip().split('\n')
    if len(lines) < 4:
        return False
    
    # Проверяем counts line (4я строка) - должна содержать количество атомов и связей
    try:
        counts_line = lines[3]
        if not counts_line.strip():
            return False
        
        # Extract atom and bond counts
        atom_count = int(counts_line[0:3].strip())
        bond_count = int(counts_line[3:6].strip())
        
        if atom_count < 0 or bond_count < 0:
            return False
            
        # Проверяем что есть достаточно строк для атомов
        if len(lines) < 4 + atom_count:
            return False
            
    except (ValueError, IndexError):
        return False
    
    return True

def _clean_sdf(sdf: str) -> str:
    """Создаем абсолютно чистый SDF с контролируемыми переносами строк"""
    try:
        lines = sdf.strip().split('\n')
        if len(lines) < 4:
            print(f"SDF too short: {len(lines)} lines")
            return None
            
        # Извлекаем количество атомов и связей
        counts_line = lines[3] if len(lines) > 3 else ""
        parts = counts_line.split()
        
        atom_count = 0
        bond_count = 0
        
        try:
            atom_count = int(parts[0])
            bond_count = int(parts[1])
            print(f"Parsed counts: {atom_count} atoms, {bond_count} bonds")
        except Exception as e:
            print(f"Failed to parse counts line '{counts_line}': {e}")
            # Если не смогли распарсить, ищем атомы вручную
            atom_count = 0
            for i, line in enumerate(lines[4:], 4):
                if line.strip() and len(line.split()) >= 4:
                    try:
                        float(line.split()[0])
                        float(line.split()[1]) 
                        float(line.split()[2])
                        atom_count += 1
                    except:
                        break
                else:
                    break
            print(f"Found {atom_count} atoms manually")
        
        if atom_count == 0:
            print("No atoms found")
            return None
            
        # Извлекаем атомы
        atoms = []
        atom_lines = lines[4:4+atom_count] if len(lines) >= 4+atom_count else lines[4:]
        
        for atom_line in atom_lines:
            try:
                atom_parts = atom_line.split()
                if len(atom_parts) >= 4:
                    x = float(atom_parts[0])
                    y = float(atom_parts[1])
                    z = float(atom_parts[2])
                    element = atom_parts[3].strip()
                    # Очищаем символ элемента
                    element = ''.join(c for c in element if c.isalpha() or c.isdigit())
                    if element:
                        atoms.append((x, y, z, element))
            except:
                continue
                
        if not atoms:
            return None
            
        # Создаем абсолютно чистый SDF с контролируемыми переносами строк
        # Используем \n для переносов строк
        clean_sdf = ""
        clean_sdf += "\n"  # Line 1: пустая
        clean_sdf += "  Molecule\n"  # Line 2: название
        clean_sdf += "\n"  # Line 3: пустая
        clean_sdf += f"{len(atoms):3d}{bond_count:3d}  0  0  0  0  0  0  0  0999 V2000\n"  # Line 4: counts
        
        # Добавляем строки атомов в строгом формате
        for x, y, z, element in atoms:
            # Форматируем точно как в SDF стандарте
            clean_sdf += f"{x:10.4f}{y:10.4f}{z:10.4f} {element.ljust(3)} 0  0  0  0  0  0  0  0  0  0  0  0\n"
            
        # Добавляем связи если они есть
        bond_start = 4 + atom_count
        actual_bonds = 0
        if len(lines) > bond_start and bond_count > 0:
            for i in range(min(bond_count, len(lines) - bond_start)):
                bond_line = lines[bond_start + i]
                if bond_line.strip():
                    # Очищаем строку связи
                    bond_parts = bond_line.split()
                    if len(bond_parts) >= 4:
                        try:
                            a1 = int(bond_parts[0])
                            a2 = int(bond_parts[1])
                            bond_type = int(bond_parts[2])
                            if 1 <= a1 <= len(atoms) and 1 <= a2 <= len(atoms):
                                clean_sdf += f"{a1:3d}{a2:3d}{bond_type:3d}  0  0  0  0\n"
                                actual_bonds += 1
                        except:
                            continue
        
        clean_sdf += "M  END\n"
        
        # Удаляем любые BOM или невидимые символы
        clean_sdf = clean_sdf.encode('ascii', errors='ignore').decode('ascii')
        
        return clean_sdf
        
    except Exception as e:
        print(f"SDF cleaning error: {e}")
        return None

async def fetch_cid_by_name(name: str) -> int | None:
    """Получить CID по названию соединения"""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(name)}/cids/JSON"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                cids = data.get("IdentifierList", {}).get("CID", [])
                return cids[0] if cids else None
    except Exception:
        pass
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

async def get_compound_info(cid: int) -> dict | None:
    """
    Получить информацию о соединении по CID
    """
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/MolecularWeight,MolecularFormula,IUPACName,Title/JSON"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                props = data.get("PropertyTable", {}).get("Properties", [{}])[0]
                
                return {
                    "weight": props.get("MolecularWeight"),
                    "formula": props.get("MolecularFormula"),
                    "name": props.get("Title") or props.get("IUPACName")
                }
    except Exception:
        pass
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
    
    cids_subset = cids[:10]  # Ограничиваем до 10 для производительности
    final_results = []
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Получаем данные из PubChem
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{','.join(map(str, cids_subset))}/property/IUPACName,MolecularFormula,MolecularWeight/JSON"
            response = await client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                props = data.get("PropertyTable", {}).get("Properties", [])
                print(f"PubChem response: {len(props)} properties found")
                
                for prop in props:
                    cid = prop.get("CID")
                    iupac = prop.get("IUPACName")
                    formula = prop.get("MolecularFormula") 
                    weight = prop.get("MolecularWeight")
                    
                    # Проверяем, это изомеры октана?
                    octane_isomers = {
                        356: "n-Октан",
                        10907: "2-Метилгептан", 
                        11594: "3-Метилгептан",
                        16212984: "2,3,3,4-Тетраметилбутан"
                    }
                    
                    if cid in octane_isomers:
                        name = octane_isomers[cid]
                    else:
                        # Используем IUPAC название или CID как запасной вариант
                        name = iupac or f"Compound {cid}"
                    
                    result = {
                        "cid": cid,
                        "name": name,
                        "iupac_name": iupac,
                        "molecular_formula": formula,
                        "molecular_weight": weight
                    }
                    print(f"Adding isomer: {result}")
                    final_results.append(result)
            else:
                # Если не удалось получить данные, создаем базовые записи
                for cid in cids_subset:
                    final_results.append({
                        "cid": cid,
                        "name": f"Compound {cid}",
                        "iupac_name": None,
                        "molecular_formula": None,
                        "molecular_weight": None
                    })
                    
    except Exception as e:
        print(f"Error fetching compound properties: {e}")
        # В случае ошибки создаем базовые записи
        for cid in cids_subset:
            final_results.append({
                "cid": cid,
                "name": f"Compound {cid}",
                "iupac_name": None,
                "molecular_formula": None,
                "molecular_weight": None
            })
    
    return final_results

async def search_isomers(formula: str) -> list[dict]:
    """Поиск изомеров для данной молекулярной формулы"""
    try:
        # Используем PubChem API для поиска соединений по формуле
        async with httpx.AsyncClient(timeout=10) as client:
            # Ищем CIDs по формуле
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/{formula}/cids/JSON"
            response = await client.get(url)
            
            if response.status_code != 200:
                print(f"No isomers found for {formula} (status {response.status_code})")
                return []
            
            data = response.json()
            cids = data.get("IdentifierList", {}).get("CID", [])
            
            if not cids:
                print(f"No CIDs found for formula {formula}")
                return []
            
            # Ограничиваем количество изомеров для производительности
            cids = cids[:10]
            
            # Получаем названия для каждого CID
            print(f"Calling fetch_compound_names with CIDs: {cids}")
            isomers = await fetch_compound_names(cids)
            print(f"fetch_compound_names returned: {len(isomers)} isomers")
            return isomers
            
    except Exception as e:
        print(f"Error searching isomers for {formula}: {e}")
        return []

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
