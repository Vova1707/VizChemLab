from sqlalchemy.orm import Session
from app.db.models import Element, BondType
from app.db.session import SessionLocal
import logging

# Настраиваем базовое логирование, если оно еще не настроено
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_db():
    db: Session = SessionLocal()
    try:
        if db.query(BondType).first():
            logger.info("Database already seeded with BondTypes.")
        else:
            bond_types = [
                BondType(id=1, label='Одинарная', value=1, color='#6b7280', style='solid'),
                BondType(id=2, label='Двойная', value=2, color='#4b5563', style='double'),
                BondType(id=3, label='Тройная', value=3, color='#1f2937', style='triple'),
                BondType(id=4, label='Клин (Вверх)', value=1, color='#6b7280', style='wedge'),
                BondType(id=5, label='Штрих (Вниз)', value=1, color='#6b7280', style='dash'),
            ]
            db.add_all(bond_types)
            logger.info("BondTypes seeded.")

        if db.query(Element).first():
            logger.info("Database already seeded with Periodic Table.")
        else:
            # Periodic table
            elements = [
                Element(symbol='H', name='Водород', valence=1, color='#FFFFFF', radius=31, group=1, period=1),
                Element(symbol='He', name='Гелий', valence=0, color='#00FFFF', radius=28, group=18, period=1),
                Element(symbol='Li', name='Литий', valence=1, color='#CC80FF', radius=128, group=1, period=2),
                Element(symbol='Be', name='Бериллий', valence=2, color='#C2FF00', radius=96, group=2, period=2),
                Element(symbol='B', name='Бор', valence=3, color='#FFB5B5', radius=84, group=13, period=2),
                Element(symbol='C', name='Углерод', valence=4, color='#909090', radius=76, group=14, period=2),
                Element(symbol='N', name='Азот', valence=3, color='#3050F8', radius=71, group=15, period=2),
                Element(symbol='O', name='Кислород', valence=2, color='#FF0D0D', radius=66, group=16, period=2),
                Element(symbol='F', name='Фтор', valence=1, color='#90E050', radius=57, group=17, period=2),
                Element(symbol='Ne', name='Неон', valence=0, color='#B3E3F5', radius=58, group=18, period=2),
                Element(symbol='Na', name='Натрий', valence=1, color='#AB5CF2', radius=154, group=1, period=3),
                Element(symbol='Mg', name='Магний', valence=2, color='#8AFF00', radius=130, group=2, period=3),
                Element(symbol='Al', name='Алюминий', valence=3, color='#BFA6A6', radius=118, group=13, period=3),
                Element(symbol='Si', name='Кремний', valence=4, color='#F0C8A0', radius=111, group=14, period=3),
                Element(symbol='P', name='Фосфор', valence=5, color='#FF8000', radius=106, group=15, period=3),
                Element(symbol='S', name='Сера', valence=6, color='#FFFF30', radius=102, group=16, period=3),
                Element(symbol='Cl', name='Хлор', valence=1, color='#1FF01F', radius=99, group=17, period=3),
                Element(symbol='Ar', name='Аргон', valence=0, color='#80D1E3', radius=97, group=18, period=3),
                Element(symbol='K', name='Калий', valence=1, color='#8F40D4', radius=196, group=1, period=4),
                Element(symbol='Ca', name='Кальций', valence=2, color='#3DFF00', radius=174, group=2, period=4),
                Element(symbol='Sc', name='Скандий', valence=3, color='#E6E6E6', radius=144, group=3, period=4),
                Element(symbol='Ti', name='Титан', valence=4, color='#BFC2C7', radius=132, group=4, period=4),
                Element(symbol='V', name='Ванадий', valence=5, color='#A6A6AB', radius=122, group=5, period=4),
                Element(symbol='Cr', name='Хром', valence=6, color='#8A99C7', radius=118, group=6, period=4),
                Element(symbol='Mn', name='Марганец', valence=7, color='#9C7AC7', radius=117, group=7, period=4),
                Element(symbol='Fe', name='Железо', valence=6, color='#E06633', radius=117, group=8, period=4),
                Element(symbol='Co', name='Кобальт', valence=5, color='#F090A0', radius=116, group=9, period=4),
                Element(symbol='Ni', name='Никель', valence=4, color='#50D050', radius=115, group=10, period=4),
                Element(symbol='Cu', name='Медь', valence=2, color='#C88033', radius=117, group=11, period=4),
                Element(symbol='Zn', name='Цинк', valence=2, color='#7D80B0', radius=120, group=12, period=4),
                Element(symbol='Ga', name='Галлий', valence=3, color='#C28F8F', radius=120, group=13, period=4),
                Element(symbol='Ge', name='Германий', valence=4, color='#668F8F', radius=122, group=14, period=4),
                Element(symbol='As', name='Мышьяк', valence=5, color='#BD80E3', radius=122, group=15, period=4),
                Element(symbol='Se', name='Селен', valence=6, color='#FFA100', radius=117, group=16, period=4),
                Element(symbol='Br', name='Бром', valence=1, color='#A62929', radius=114, group=17, period=4),
                Element(symbol='Kr', name='Криптон', valence=0, color='#5CB8D1', radius=110, group=18, period=4),
                Element(symbol='Rb', name='Рубидий', valence=1, color='#702EB0', radius=211, group=1, period=5),
                Element(symbol='Sr', name='Стронций', valence=2, color='#00FF00', radius=192, group=2, period=5),
                Element(symbol='Y', name='Иттрий', valence=3, color='#94FFFF', radius=162, group=3, period=5),
                Element(symbol='Zr', name='Цирконий', valence=4, color='#94E0E0', radius=148, group=4, period=5),
                Element(symbol='Nb', name='Ниобий', valence=5, color='#73C2C9', radius=137, group=5, period=5),
                Element(symbol='Mo', name='Молибден', valence=6, color='#54B5B5', radius=130, group=6, period=5),
                Element(symbol='Tc', name='Технеций', valence=7, color='#3B9E9E', radius=127, group=7, period=5),
                Element(symbol='Ru', name='Рутений', valence=8, color='#248F8F', radius=125, group=8, period=5),
                Element(symbol='Rh', name='Родий', valence=6, color='#0A7D8C', radius=125, group=9, period=5),
                Element(symbol='Pd', name='Палладий', valence=4, color='#006985', radius=128, group=10, period=5),
                Element(symbol='Ag', name='Серебро', valence=1, color='#C0C0C0', radius=134, group=11, period=5),
                Element(symbol='Cd', name='Кадмий', valence=2, color='#FFD98F', radius=148, group=12, period=5),
                Element(symbol='In', name='Индий', valence=3, color='#A67573', radius=144, group=13, period=5),
                Element(symbol='Sn', name='Олово', valence=4, color='#668080', radius=141, group=14, period=5),
                Element(symbol='Sb', name='Сурьма', valence=5, color='#9E63B5', radius=140, group=15, period=5),
                Element(symbol='Te', name='Теллур', valence=6, color='#D47A00', radius=136, group=16, period=5),
                Element(symbol='I', name='Иод', valence=1, color='#940094', radius=133, group=17, period=5),
                Element(symbol='Xe', name='Ксенон', valence=0, color='#429EB0', radius=130, group=18, period=5),
                Element(symbol='Cs', name='Цезий', valence=1, color='#57178F', radius=225, group=1, period=6),
                Element(symbol='Ba', name='Барий', valence=2, color='#00C900', radius=198, group=2, period=6),
                Element(symbol='La', name='Лантан', valence=3, color='#70D4FF', radius=169, group=3, period=6),
                Element(symbol='Ce', name='Церий', valence=4, color='#FFFFC7', radius=165, group=3, period=6),
                Element(symbol='W', name='Вольфрам', valence=6, color='#2194D6', radius=146, group=6, period=6),
                Element(symbol='Pt', name='Платина', valence=4, color='#D0D0E0', radius=128, group=10, period=6),
                Element(symbol='Au', name='Золото', valence=3, color='#FFD123', radius=144, group=11, period=6),
                Element(symbol='Hg', name='Ртуть', valence=2, color='#B8B8D0', radius=149, group=12, period=6),
                Element(symbol='Pb', name='Свинец', valence=4, color='#575961', radius=147, group=14, period=6),
                Element(symbol='Bi', name='Висмут', valence=5, color='#9E4FB5', radius=146, group=15, period=6),
                Element(symbol='Rn', name='Радон', valence=0, color='#428296', radius=145, group=18, period=6),
                Element(symbol='U', name='Уран', valence=6, color='#008FFF', radius=170, group=3, period=7),
            ]
            db.add_all(elements)
            logger.info("Periodic Table seeded.")
        
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
