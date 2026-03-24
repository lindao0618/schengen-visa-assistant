#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
import json

URL = "https://tls.vis.lol/api/users"
PARAMS = {"offset": 50, "limit": 50}

# 这里替换成你自己的 token
TOKEN = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"

def headers_get():
    return {
        "x-vis-lol-token": TOKEN,
        "X-Vis-Lol-Api": "tls",
        "Origin": "https://tls.vis.lol",
        "User-Agent": "PythonRequests/2.x",
        "Accept": "application/json",
    }

def fetch_appointments():
    try:
        resp = requests.get(URL, params=PARAMS, headers=headers_get(), timeout=10)
        print(f"请求URL: {resp.url}")
        print(f"状态码: {resp.status_code}")
        if "application/json" in resp.headers.get("Content-Type", ""):
            data = resp.json()
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(resp.text[:1000])
        resp.raise_for_status()
    except Exception as e:
        print(f"请求失败: {e}")

if __name__ == "__main__":
    fetch_appointments()
