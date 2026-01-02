import httpx
import re
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from urllib.parse import quote
from datetime import datetime
from app.db.session import get_db
from app.db.models import SearchHistory, User
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.utils import pubchem

router = APIRouter()

@router.post("/api/lookup-formula")
async def lookup_formula(
    formula: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    """Поиск SDF по химической формуле"""
    # fetch_pubchem_sdf_by_formula сам пробует 3D, затем 2D
    sdf = await pubchem.fetch_pubchem_sdf_by_formula(formula, record_type="3d")
    
    if not sdf:
        # Попробуем еще раз как название
        sdf = await pubchem.fetch_pubchem_sdf_by_name(formula, record_type="3d")
        if not sdf:
            sdf = await pubchem.fetch_pubchem_sdf_by_name(formula, record_type="2d")
            
    if not sdf:
        raise HTTPException(status_code=404, detail="Compound not found for this formula")
    
    return {"sdf": sdf}


@router.post("/api/visualize")
async def visualize_compound(
    compound: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional)
):
    # Сохраняем в историю только если пользователь авторизован
    if current_user:
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

    # 1. Пробуем найти как название
    trans = await pubchem._maybe_translate_to_en(compound)
    query = trans or compound
    
    for rt in ["3d", "2d"]:
        sdf = await pubchem.fetch_pubchem_sdf_by_name(query, record_type=rt)
        if sdf:
            return {
                "compound": compound,
                "source": "PubChem",
                "format": "sdf",
                "data": sdf,
            }

    # 2. Если не нашли как название, проверяем, не формула ли это
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


@router.get("/api/search-compound/{query}")
async def search_compound(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Поиск соединений по названию или формуле (для выпадающего списка)"""
    trans = await pubchem._maybe_translate_to_en(query)
    search_query = trans or query
    
    # 1. CID по названию
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{quote(search_query)}/cids/JSON?MaxRecords=10"
    cids = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 200:
                cids = r.json().get("IdentifierList", {}).get("CID", [])
    except Exception:
        pass
        
    # 2. По формуле
    if not cids:
        cids = await pubchem.fetch_cids_by_formula(search_query)
        
    if not cids:
        return []
        
    # 3. Названия
    return await pubchem.fetch_compound_names(cids)


@router.get("/api/visualize/history")
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


@router.delete("/api/visualize/history/{query}")
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
