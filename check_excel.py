import pandas as pd

# 检查模板文件
print("=== 检查模板文件 ===")
df_template = pd.read_excel('ds160_data模板.xlsx')
print("模板文件中的地址和联系信息字段:")
for _, row in df_template.iterrows():
    field = row.get('Field', '')
    if field and ('address' in str(field).lower() or 'phone' in str(field).lower() or 'email' in str(field).lower() or 'home' in str(field).lower() or 'hotel' in str(field).lower()):
        print(f"  {field}")

# 检查当前上传的文件
print("\n=== 检查当前上传的文件 ===")
try:
    df_current = pd.read_excel('temp/ds160-1753011661313/ds160_data.xlsx')
    print("当前文件中的地址和联系信息数据:")
    for _, row in df_current.iterrows():
        field = row.get('Field', '')
        value = row.get('填写内容', '')
        if field and ('address' in str(field).lower() or 'phone' in str(field).lower() or 'email' in str(field).lower() or 'home' in str(field).lower() or 'hotel' in str(field).lower()):
            print(f"  {field}: {value}")
except Exception as e:
    print(f"无法读取当前文件: {e}") 