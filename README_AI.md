# Умный визуализатор молекул - Архитектура

## 🧠 Компоненты системы

### 1. **Google Gemini API** (Интегрировано ✅)
- **Назначение**: Обработка естественного языка
- **Функции**:
  - Парсинг запросов пользователя ("покажи воду" → H2O)
  - Извлечение химических формул из текста
  - Генерация кратких описаний молекул
- **Endpoint**: `/api/visualize` → `parse_with_gemini()`

### 2. **PubChem API** (Интегрировано ✅)
- **Назначение**: Получение данных о молекулах
- **Функции**:
  - Поиск CID по названию/формуле
  - Получение свойств (молекулярная масса, IUPAC название)
- **Endpoint**: `/api/visualize` → `get_pubchem_data()`

### 3. **Ваша нейронная сеть** (Предложение)
Рекомендую создать нейронную сеть для:

#### Вариант A: Предсказание свойств молекул
- **Вход**: SMILES/InChI формула
- **Выход**: Растворимость, температура кипения, токсичность
- **Модель**: Graph Neural Network (GNN) или Transformer
- **Данные**: ChEMBL, PubChem

#### Вариант B: Генерация 3D структур
- **Вход**: SMILES строка
- **Выход**: 3D координаты атомов
- **Модель**: Variational Autoencoder (VAE) или Diffusion Model
- **Библиотека**: RDKit + PyTorch

#### Вариант C: Классификация реакций
- **Вход**: Реагенты и продукты
- **Выход**: Тип реакции (окисление, восстановление, замещение)
- **Модель**: Transformer или CNN
- **Данные**: USPTO, Reaxys

### 4. **Локальная химическая БД** (Предложение)
Создать таблицу в PostgreSQL:

```sql
CREATE TABLE molecules (
    id SERIAL PRIMARY KEY,
    formula VARCHAR(50),
    name VARCHAR(200),
    smiles TEXT,
    inchi TEXT,
    molecular_weight FLOAT,
    structure_3d JSONB,  -- координаты атомов
    properties JSONB,    -- кэш свойств
    pubchem_cid INTEGER,
    created_at TIMESTAMP
);
```

## 🚀 Следующие шаги

1. **Добавить GEMINI_API_KEY в .env**:
   ```
   GEMINI_API_KEY=AIzaSyDZWO8FIRvZgciuW_zlSQspv2vVFTUn_QE
   ```

2. **Установить зависимости**:
   ```bash
   pip install httpx
   ```

3. **Протестировать визуализатор**:
   - Откройте `/visualizer`
   - Введите "вода" или "H2O"
   - Увидите 3D структуру + информацию

4. **Для собственной нейронной сети**:
   - Выберите задачу (A, B или C)
   - Подготовьте датасет
   - Обучите модель (PyTorch/TensorFlow)
   - Интегрируйте через FastAPI endpoint

## 📊 Пример использования

```python
# Backend: app/api/v1/endpoints/pages.py
@router.post("/api/predict-properties")
async def predict_properties(smiles: str = Body(...)):
    # Ваша нейронная сеть
    model = load_model("molecule_properties.pth")
    properties = model.predict(smiles)
    return {"properties": properties}
```

## 🔗 Полезные ресурсы

- **PubChem API**: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
- **RDKit**: https://www.rdkit.org/ (для работы с молекулами)
- **ChEMBL**: https://www.ebi.ac.uk/chembl/ (датасет для обучения)
- **Ollama**: https://ollama.ai/ (альтернатива Gemini, локально)

 uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload
 npm run dev 
