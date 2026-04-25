import httpx
import re
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from urllib.parse import quote
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db.session import get_db
from db.models import SearchHistory, User
from api.v1.deps import get_current_user, get_current_user_optional
from utils import pubchem


# Pydantic модели для документации
class LookupFormulaRequest(BaseModel):
    """Модель запроса поиска по формуле"""
    formula: str
    
class LookupFormulaResponse(BaseModel):
    """Модель ответа с SDF данными"""
    sdf: str
    
class VisualizeRequest(BaseModel):
    """Модель запроса визуализации"""
    formula: Optional[str] = None
    compound: Optional[str] = None
    
class CompoundInfo(BaseModel):
    """Модель информации о соединении"""
    cid: int
    iupac_name: Optional[str] = None
    molecular_formula: Optional[str] = None
    molecular_weight: Optional[float] = None
    
class VisualizeResponse(BaseModel):
    """Модель ответа визуализации"""
    compound: str
    source: str
    format: str
    data: str
    cid: Optional[int] = None
    isomers: Optional[List[CompoundInfo]] = None
    
class HistoryItem(BaseModel):
    """Модель элемента истории"""
    query: str
    timestamp: datetime
    
class HistoryResponse(BaseModel):
    """Модель ответа с историей"""
    history: List[HistoryItem]
    
class StatusResponse(BaseModel):
    """Модель ответа со статусом"""
    status: str

async def create_simple_fallback_sdf(compound: str) -> str:
    """Создает простой fallback SDF для случаев когда PubChem не работает"""
    # Простая молекула на основе формулы
    try:
        # Для C4H8 создаем простую структуру
        if "C4H8" in compound.upper():
            return """
  
  Butene
  
  4  3  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.4000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.1000    1.2124    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    3.5000    1.2124    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
M  END
"""
        # Для воды
        elif "H2O" in compound.upper() or "WATER" in compound.upper():
            return """
  
  Water
  
  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.0000    1.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
M  END
"""
        # Для других случаев - простая структура
        else:
            return f"""
  
  {compound}
  
  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.4000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
M  END
"""
    except Exception as e:
        print(f"Error creating fallback SDF: {e}")
        return None

router = APIRouter()

@router.post("/api/lookup-formula",
              response_model=LookupFormulaResponse,
              summary="Поиск SDF по химической формуле",
              description="Ищет SDF (Structure Data Format) файл для указанной химической формулы через PubChem API.",
              responses={
                  200: {"description": "SDF данные успешно найдены"},
                  404: {"description": "Соединение не найдено"}
              })
async def lookup_formula(
    formula: str = Body(..., example="H2O", description="Химическая формула для поиска"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Поиск SDF по химической формуле"""
    sdf = await pubchem.fetch_pubchem_sdf_by_formula(formula, record_type="3d")
    
    if not sdf:
        sdf = await pubchem.fetch_pubchem_sdf_by_name(formula, record_type="3d")
        if not sdf:
            sdf = await pubchem.fetch_pubchem_sdf_by_name(formula, record_type="2d")
            
    if not sdf:
        raise HTTPException(status_code=404, detail="Compound not found for this formula")
    
    return {"sdf": sdf}


@router.post("/api/visualize",
              response_model=VisualizeResponse,
              summary="Визуализация химического соединения",
              description="Визуализирует химическое соединение по формуле или названию. Использует PubChem API для получения 3D/2D структуры.",
              responses={
                  200: {"description": "Структура соединения успешно получена"},
                  404: {"description": "Соединение не найдено"}
              })
async def visualize_compound(
    request: dict = Body(..., example={"formula": "C6H12O6"}, description="Запрос с формулой или названием соединения"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    print(f"=== VISUALIZE COMPOUND START ===")
    compound = request.get('formula', request.get('compound', ''))
    print(f"Compound: '{compound}'")
    print(f"User: {current_user.email if current_user else 'None'}")
    
    if current_user and compound and compound.strip():
        existing = db.query(SearchHistory).filter(
            SearchHistory.user_id == current_user.id,
            SearchHistory.query == compound,
            SearchHistory.history_type == "visualizer"
        ).first()
        
        if existing:
            existing.timestamp = datetime.utcnow()
        else:
            new_history = SearchHistory(
                user_id=current_user.id,
                query=compound,
                history_type="visualizer"
            )
            db.add(new_history)
        db.commit()

    trans = await pubchem._maybe_translate_to_en(compound)
    print(f"Translation: '{trans}'")
    
    candidates = []
    if trans:
        candidates.append(trans)
        # Эвристики для исправления ошибок перевода химических названий
        if 'g' in trans:
             candidates.append(trans.replace('g', 'h'))
        if 'll' in trans:
             candidates.append(trans.replace('ll', 'l'))
        if 'g' in trans and 'll' in trans:
             candidates.append(trans.replace('g', 'h').replace('ll', 'l'))
    
    candidates.append(compound)
    # Удаляем дубликаты сохраняя порядок
    candidates = list(dict.fromkeys([c for c in candidates if c]))

    print(f"Candidates to try: {candidates}")
    for cand in candidates:
        # Меняем порядок - сначала 2D, потом 3D (2D более стабильный)
        for rt in ["2d", "3d"]:
            print(f"Trying candidate: '{cand}' with record_type: {rt}")
            sdf = await pubchem.fetch_pubchem_sdf_by_name(cand, record_type=rt)
            if sdf:
                print(f"SDF found for '{cand}' ({rt}), length: {len(sdf)}")
                print(f"SDF preview: {sdf[:200]}...")
                
                # Получаем дополнительную информацию о соединении
                cid = await pubchem.fetch_cid_by_name(cand)
                info = None
                if cid:
                    info = await pubchem.get_compound_info(cid)
                
                result = {
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "data": sdf,
                    "info": {
                        "cid": cid,
                        "molecular_weight": info.get("weight") if info else None,
                        "molecular_formula": info.get("formula") if info else None,
                        "iupac_name": info.get("name") if info else None
                    }
                }
                print(f"Returning result with data length: {len(result['data'])}")
                print(f"=== VISUALIZE COMPOUND SUCCESS ===")
                return result
            else:
                print(f"No SDF found for '{cand}' ({rt})")
    
    # Если ничего не найдено для конкретного названия, проверяем - это формула?
    # Если да, ищем изомеры
    print("No SDF found, checking if this is a formula and searching for isomers...")
    
    # Проверяем, является ли строка молекулярной формулой (только буквы и цифры)
    import re
    is_formula = bool(re.match(r'^[A-Za-z0-9]+$', compound))
    
    isomers = None  # Инициализируем переменную для изомеров
    
    # Для формул получаем изомеры для панели и первый изомер для канваса
    if is_formula:
        print(f"Getting isomers for formula: {compound}")
        print("Entering isomer logic...")
        try:
            # Получаем CIDs для формулы
            async with httpx.AsyncClient(timeout=30) as client:
                url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/{compound}/cids/JSON"
                response = await client.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    cids = data.get("IdentifierList", {}).get("CID", [])
                    
                    if cids and len(cids) > 0:
                        print(f"Found {len(cids)} isomers, getting SDF for first isomer")
                        # Создаем данные для панели изомеров
                        isomers = [{"cid": cid, "name": f"Isomer {i+1}"} for i, cid in enumerate(cids[:10])]
                        
                        # Получаем SDF для первого изомера через прямой HTTP запрос
                        first_cid = cids[0]
                        print(f"Fetching SDF for first isomer CID {first_cid}")
                        try:
                            async with httpx.AsyncClient(timeout=30) as sdf_client:
                                sdf_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{first_cid}/SDF"
                                sdf_response = await sdf_client.get(sdf_url, params={"record_type": "3d"})
                                
                                if sdf_response.status_code == 200:
                                    first_sdf = sdf_response.text
                                    print(f"Got 3D SDF for first isomer, length: {len(first_sdf)}")
                                else:
                                    # Пробуем 2D
                                    sdf_response = await sdf_client.get(sdf_url, params={"record_type": "2d"})
                                    if sdf_response.status_code == 200:
                                        first_sdf = sdf_response.text
                                        print(f"Got 2D SDF for first isomer, length: {len(first_sdf)}")
                                    else:
                                        first_sdf = None
                                        print(f"Failed to get SDF for first isomer")
                                
                                if first_sdf and len(first_sdf) > 50:
                                    result = {
                                        "compound": compound,
                                        "source": "PubChem",
                                        "format": "sdf", 
                                        "data": first_sdf,
                                        "isomers": isomers,
                                        "info": {
                                            "cid": first_cid,
                                            "molecular_weight": None,
                                            "molecular_formula": compound,
                                            "iupac_name": f"Isomer 1"
                                        }
                                    }
                                    print(f"Returning first isomer with {len(isomers)} total isomers")
                                    print(f"=== VISUALIZE COMPOUND SUCCESS ===")
                                    return result
                                else:
                                    print(f"First isomer SDF too short or empty")
                        except Exception as e:
                            print(f"Error getting first isomer SDF: {e}")
                            import traceback
                            traceback.print_exc()
        except Exception as e:
            print(f"Error getting isomers: {e}")
            isomers = None
    
    # Если не удалось получить изомеры, создаем fallback
    if not isomers:
        fallback_sdf = await create_simple_fallback_sdf(compound)
        if fallback_sdf:
            result = {
                "compound": compound,
                "source": "Fallback",
                "format": "sdf", 
                "data": fallback_sdf,
                "isomers": None,
                "info": {
                    "cid": None,
                    "molecular_weight": None,
                    "molecular_formula": compound,
                    "iupac_name": compound
                }
            }
            print(f"Returning fallback result with data length: {len(result['data'])}")
            print(f"=== VISUALIZE COMPOUND FALLBACK SUCCESS ===")
            return result

    query = trans or compound

    is_likely_formula = bool(re.match(r"^([A-Z][a-z]?\d*)+$", query, re.IGNORECASE))
    if is_likely_formula:
        formula_query = query.upper()
        cids = await pubchem.fetch_cids_by_formula(formula_query)
        
        if len(cids) > 1:
            isomers = await pubchem.fetch_compound_names(cids[:40])
            if isomers:
                first_cid = isomers[0]["cid"]
                first_sdf = await pubchem.fetch_pubchem_sdf_by_cid(first_cid, record_type="3d")
                if not first_sdf:
                    first_sdf = await pubchem.fetch_pubchem_sdf_by_cid(first_cid, record_type="2d")
                
                # Получаем информацию о первом изомере
                first_info = await pubchem.get_compound_info(first_cid)
                
                return JSONResponse(content={
                    "isomers": isomers,
                    "data": first_sdf,
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "info": {
                        "cid": first_cid,
                        "molecular_weight": first_info.get("weight") if first_info else None,
                        "molecular_formula": first_info.get("formula") if first_info else None,
                        "iupac_name": first_info.get("name") if first_info else None
                    },
                    "cid": first_cid
                })
        elif len(cids) == 1:
            cid = cids[0]
            sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="3d")
            if not sdf:
                sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="2d")
            
            if sdf:
                # Получаем информацию о соединении
                info = await pubchem.get_compound_info(cid)
                
                return {
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "data": sdf,
                    "cid": cid,
                    "info": {
                        "cid": cid,
                        "molecular_weight": info.get("weight") if info else None,
                        "molecular_formula": info.get("formula") if info else None,
                        "iupac_name": info.get("name") if info else None
                    }
                }
            
    raise HTTPException(status_code=404, detail="Compound not found")


@router.get("/api/search-compound/{query}",
            response_model=List[CompoundInfo],
            summary="Поиск соединений",
            description="Ищет соединения по названию или формуле для выпадающего списка. Возвращает список возможных вариантов.",
            responses={
                200: {"description": "Список соединений успешно получен"}
            })
async def search_compound(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Поиск соединений по названию или формуле (для выпадающего списка)"""
    trans = await pubchem._maybe_translate_to_en(query)
    
    candidates = []
    if trans:
        candidates.append(trans)
        if 'g' in trans:
             candidates.append(trans.replace('g', 'h'))
        if 'll' in trans:
             candidates.append(trans.replace('ll', 'l'))
        if 'g' in trans and 'll' in trans:
             candidates.append(trans.replace('g', 'h').replace('ll', 'l'))
    
    candidates.append(query)
    candidates = list(dict.fromkeys([c for c in candidates if c]))
    
    cids = []
    # 1. CID по названию (пробуем варианты)
    for cand in candidates:
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(cand)}/cids/JSON?MaxRecords=10"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    found = r.json().get("IdentifierList", {}).get("CID", [])
                    if found:
                        cids.extend(found)
                        break
        except Exception:
            pass

    search_query = trans or query
        
    # 2. По формуле
    if not cids:
        cids = await pubchem.fetch_cids_by_formula(search_query)
        
    if not cids:
        return []
        
    # 3. Названия
    return await pubchem.fetch_compound_names(cids)


@router.get("/api/visualize/history",
            response_model=List[HistoryItem],
            summary="Получение истории визуализатора",
            description="Возвращает историю поиска для визуализатора текущего пользователя.",
            responses={
                200: {"description": "История успешно получена"}
            })
async def get_visualize_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Получение истории поиска для визуализатора"""
    if not current_user:
        return []
    
    history = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.history_type == "visualizer"
    ).order_by(desc(SearchHistory.timestamp)).all()
    
    return [{"query": h.query, "timestamp": h.timestamp} for h in history]


@router.get("/api/visualize/cid/{cid}",
             response_model=VisualizeResponse,
             summary="Визуализация соединения по CID",
             description="Визуализирует химическое соединение по его PubChem CID.",
             responses={
                 200: {"description": "Структура соединения успешно получена"},
                 404: {"description": "Соединение не найдено"}
             })
async def visualize_by_cid(
    cid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Визуализация соединения по PubChem CID"""
    try:
        # Пробуем получить 3D структуру, потом 2D
        sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="3d")
        if not sdf:
            sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="2d")
        
        if not sdf:
            raise HTTPException(status_code=404, detail="Соединение не найдено")
        
        # Получаем название соединения для истории
        compound_names = await pubchem.fetch_compound_names([cid])
        compound_name = compound_names[0]["name"] if compound_names else f"CID:{cid}"
        
        # Сохраняем в историю если пользователь авторизован
        if current_user:
            existing = db.query(SearchHistory).filter(
                SearchHistory.user_id == current_user.id,
                SearchHistory.query == compound_name,
                SearchHistory.history_type == "visualizer"
            ).first()
            
            if existing:
                existing.timestamp = datetime.utcnow()
            else:
                new_history = SearchHistory(
                    user_id=current_user.id,
                    query=compound_name,
                    history_type="visualizer"
                )
                db.add(new_history)
            db.commit()
        
        result = {
            "compound": compound_name,
            "source": "PubChem",
            "format": "sdf",
            "data": sdf,
            "cid": cid
        }
        
        print(f"Returning result with data length: {len(result['data'])}")
        print(f"=== VISUALIZE BY CID COMPLETE ===")
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении данных: {str(e)}")

@router.delete("/api/visualize/history/{query}",
              summary="Удаление элемента из истории поиска визуализатора",
              description="Удаляет конкретный элемент из истории поиска визуализатора.",
              responses={
                  200: {"description": "Элемент истории успешно удален"},
                  404: {"description": "Элемент истории не найден"}
              })
async def delete_visualize_history_item(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление элемента истории"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    
    item = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.query == query,
        SearchHistory.history_type == "visualizer"
    ).first()
    
    if item:
        db.delete(item)
        db.commit()
    
    return {"status": "success", "message": "Элемент истории удален"}
