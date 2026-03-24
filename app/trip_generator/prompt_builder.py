def build_prompt(city, start, end, hotel, used_attractions=None, lang='zh'):
    used_attractions = used_attractions or []
    used_attractions_str = ", ".join(used_attractions)
    
    if lang == 'zh':
        used_str = f"\n已使用过的景点（请勿重复推荐）: {used_attractions_str}" if used_attractions else ""
        return f"""
请列出 {city} 在 {start} 到 {end} 期间的经典景点（请用英文回答）：
酒店信息:
- 名称: {hotel['名称']}
- 地址: {hotel['地址']}
- 电话: {hotel['电话']}

时间范围: {start} - {end}
景点: [景点1], [景点2], [景点3]...

格式参考
日期1：景点
日期2：景点
....

注意:
1. 避免闭馆场所，例如博物馆周一闭馆
2. 返回上述格式，不要添加其他内容
3. 景点不要重复，不要出现同一个景点
4. 必须考虑酒店位置，根据酒店地址合理安排景点顺序：
   - 选择距离酒店适当距离的景点
   - 每天的景点路线要形成合理闭环（从酒店出发，最后回到酒店）
   - 相邻景点之间的距离要适中，避免来回奔波
5. 整个路线要符合游客的出行习惯，不要出现不合理的路线，不能早上去北边，下午去南边，晚上又去北边
6. 景点个数为1-3个，尽量能推荐3个景点
7. 如果推荐凡尔赛宫(Palace of Versailles/Château de Versailles)，则当天只去这一个景点{used_str}
"""
    else:
        used_str = f"\nPreviously used attractions (do not recommend again): {used_attractions_str}" if used_attractions else ""
        return f"""
List famous attractions in {city}, France for the period from {start} to {end}.

Hotel Information:
- Name: {hotel['名称']}
- Address: {hotel['地址']}
- Phone: {hotel['电话']}

Time Range: {start} - {end}
Attractions: [attraction1], [attraction2], [attraction3]

Format reference:
2025.08.13: Attraction1, Attraction2
2025.08.14: Attraction
....

Note:
1. Avoid locations that are closed on that day (e.g., museums on Mondays)
2. Return in the above format, no additional content
3. Attractions should not be repeated, and the same attraction should not appear
4. Must consider hotel location and plan attractions accordingly:
   - Choose attractions within reasonable distance from the hotel
   - Create logical daily routes (starting from hotel and returning to hotel)
   - Maintain appropriate distances between adjacent attractions
5. The entire route should conform to the habits of tourists, and unreasonable routes should not appear, such as going to the north in the morning, then to the south in the afternoon, and then to the north in the evening
6. The number of attractions should be 1-3, try to recommend 3 attractions  
7. If Palace of Versailles (Château de Versailles) is recommended, it should be the only attraction for that day{used_str}
"""
