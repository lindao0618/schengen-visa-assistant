from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
from checker import check_photo
from flask_cors import CORS
  # 引入你原来的函数

app = Flask(__name__)
CORS(app) 

UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/check_photo', methods=['POST'])
def check_photo_api():
    if 'photo' not in request.files:
        return jsonify({'success': False, 'message': '缺少照片文件字段'}), 400
    
    file = request.files['photo']
    if file.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'}), 400

    filename = secure_filename(file.filename)
    photo_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(photo_path)

    success, message, result = check_photo(photo_path)
    os.remove(photo_path)  # 可选：检测完成后删除上传文件
    return jsonify(result), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
