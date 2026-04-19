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
    compound = request.get('formula', request.get('compound', ''))
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

    for cand in candidates:
        for rt in ["3d", "2d"]:
            sdf = await pubchem.fetch_pubchem_sdf_by_name(cand, record_type=rt)
            if sdf:
                return {
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "data": sdf,
                }

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
                
                return JSONResponse(content={
                    "isomers": isomers,
                    "data": first_sdf,
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "cid": first_cid
                })
        elif len(cids) == 1:
            cid = cids[0]
            sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="3d")
            if not sdf:
                sdf = await pubchem.fetch_pubchem_sdf_by_cid(cid, record_type="2d")
            
            if sdf:
                return {
                    "compound": compound,
                    "source": "PubChem",
                    "format": "sdf",
                    "data": sdf,
                    "cid": cid
                }

    # 3. Fallback
    sdf = await pubchem.get_sdf_any(compound)
    if sdf:
        return {
            "compound": compound,
            "source": "PubChem",
            "format": "sdf",
            "data": sdf,
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
    current_user: User = Depends(get_current_user)
):
    """Получение истории поиска для визуализатора"""
    history = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.history_type == "visualizer"
    ).order_by(desc(SearchHistory.timestamp)).all()
    
    return [{"query": h.query, "timestamp": h.timestamp} for h in history]


@router.delete("/api/visualize/history/{query}",
               response_model=StatusResponse,
               summary="Удаление элемента истории",
               description="Удаляет конкретный элемент из истории поиска визуализатора.",
               responses={
                   200: {"description": "Элемент успешно удален"},
                   404: {"description": "Элемент истории не найден"}
               })
async def delete_visualize_history_item(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление элемента истории"""
    item = db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id,
        SearchHistory.query == query,
        SearchHistory.history_type == "visualizer"
    ).first()
    
    if item:
        db.delete(item)
        db.commit()
        return {"status": "ok"}
    
    raise HTTPException(status_code=404, detail="History item not found")
