#!/usr/bin/env python3
"""
测试远程服务器API
"""

import requests
import json

BASE_URL = "https://memory.91wz.org"

def test_api():
    print("=== 测试远程服务器API ===\n")
    
    # 1. 健康检查
    print("1. 健康检查")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"   状态: {r.status_code}")
        print(f"   响应: {r.json()}")
    except Exception as e:
        print(f"   错误: {e}")
    
    print()
    
    # 2. 用户登录
    print("2. 用户登录")
    token = None
    try:
        r = requests.post(
            f"{BASE_URL}/api/v1/users/login",
            json={"username": "admin", "password": "admin123456"},
            timeout=10
        )
        print(f"   状态: {r.status_code}")
        data = r.json()
        if data.get('success'):
            token = data.get('data', {}).get('token')
            print(f"   登录成功! Token: {token[:20]}..." if token else "   登录成功但无token")
        else:
            print(f"   登录失败: {data.get('message')}")
    except Exception as e:
        print(f"   错误: {e}")
    
    print()
    
    # 3. 获取记忆列表
    if token:
        print("3. 获取记忆列表")
        try:
            r = requests.get(
                f"{BASE_URL}/api/v1/memories",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            print(f"   状态: {r.status_code}")
            data = r.json()
            if data.get('success'):
                memories = data.get('data', {}).get('memories', [])
                print(f"   记忆数量: {len(memories)}")
            else:
                print(f"   错误: {data.get('message')}")
        except Exception as e:
            print(f"   错误: {e}")
    
    print()
    
    # 4. 测试页面
    print("4. 测试页面访问")
    pages = ['/', '/login', '/dashboard', '/chat', '/intelligence', '/review', 
             '/visualization', '/providers', '/security', '/knowledge', '/api-docs', 
             '/profile', '/admin']
    
    for page in pages:
        try:
            r = requests.get(f"{BASE_URL}{page}", timeout=10)
            status = "✅" if r.status_code == 200 else "❌"
            print(f"   {status} {page}: {r.status_code}")
        except Exception as e:
            print(f"   ❌ {page}: 错误 - {e}")

if __name__ == '__main__':
    test_api()
