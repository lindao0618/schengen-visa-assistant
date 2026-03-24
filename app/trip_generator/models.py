from pydantic import BaseModel
from typing import List, Dict

class HotelInfo(BaseModel):
    名称: str
    地址: str
    电话: str

class CityPlan(BaseModel):
    城市: str
    开始时间: str
    结束时间: str
    景点列表: List[str]
    酒店: HotelInfo

class ItineraryRequest(BaseModel):
    国家: str
    交通方式: str
    日程安排: List[CityPlan]