#!/usr/bin/env python3
"""
CRUD API深度检测测试
"""

import paramiko
import json

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

def run_crud_test():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            hostname=CONFIG['host'],
            port=CONFIG['port'],
            username=CONFIG['username'],
            password=CONFIG['password'],
            timeout=30
        )
        
        results = {'create': None, 'read': None, 'update': None, 'delete': None}
        
        # 1. CREATE - 创建记忆
        print("=== CREATE Test ===")
        create_cmd = '''curl -s -X POST http://localhost:1777/api/v1/memories \
            -H "Content-Type: application/json" \
            -d '{"content":"CRUD深度检测测试 - 第1轮CREATE","importance_score":9,"tags":["test","crud","round1"]}' '''
        stdin, stdout, stderr = client.exec_command(create_cmd)
        create_result = stdout.read().decode('utf-8')
        print(f"CREATE: {create_result}")
        results['create'] = json.loads(create_result) if create_result else None
        
        # 获取创建的记忆ID
        memory_id = None
        if results['create'] and results['create'].get('success'):
            memory_id = results['create'].get('id') or results['create'].get('memory', {}).get('id')
        
        # 2. READ - 读取记忆列表
        print("\n=== READ Test ===")
        read_cmd = 'curl -s http://localhost:1777/api/v1/memories'
        stdin, stdout, stderr = client.exec_command(read_cmd)
        read_result = stdout.read().decode('utf-8')
        read_data = json.loads(read_result) if read_result else {}
        memories = read_data.get('memories', [])
        print(f"READ: Found {len(memories)} memories")
        
        # 找到测试记忆
        test_memory = None
        for m in memories:
            if 'CRUD深度检测' in m.get('content', ''):
                test_memory = m
                memory_id = m.get('id')
                break
        
        results['read'] = {
            'count': len(memories),
            'found_test_memory': test_memory is not None,
            'memory_id': memory_id
        }
        
        if memory_id:
            # 3. UPDATE - 更新记忆
            print(f"\n=== UPDATE Test (ID: {memory_id}) ===")
            update_cmd = f'''curl -s -X PUT http://localhost:1777/api/v1/memories/{memory_id} \
                -H "Content-Type: application/json" \
                -d '{{"content":"CRUD深度检测测试 - 第1轮UPDATE成功！","importance_score":10,"tags":["test","crud","update","round1"]}}' '''
            stdin, stdout, stderr = client.exec_command(update_cmd)
            update_result = stdout.read().decode('utf-8')
            print(f"UPDATE: {update_result}")
            results['update'] = json.loads(update_result) if update_result else None
            
            # 4. DELETE - 删除记忆
            print(f"\n=== DELETE Test (ID: {memory_id}) ===")
            delete_cmd = f'curl -s -X DELETE http://localhost:1777/api/v1/memories/{memory_id}'
            stdin, stdout, stderr = client.exec_command(delete_cmd)
            delete_result = stdout.read().decode('utf-8')
            print(f"DELETE: {delete_result}")
            results['delete'] = json.loads(delete_result) if delete_result else None
        else:
            print("No test memory found for UPDATE/DELETE tests")
        
        # 验证删除
        print("\n=== VERIFY DELETE ===")
        stdin, stdout, stderr = client.exec_command(read_cmd)
        verify_result = stdout.read().decode('utf-8')
        verify_data = json.loads(verify_result) if verify_result else {}
        remaining = [m for m in verify_data.get('memories', []) if m.get('id') == memory_id]
        print(f"Memory {memory_id} still exists: {len(remaining) > 0}")
        
        client.close()
        
        print("\n=== CRUD Test Summary ===")
        print(f"CREATE: {'✅' if results['create'] and results['create'].get('success') else '❌'}")
        print(f"READ: {'✅' if results['read'] and results['read']['found_test_memory'] else '❌'}")
        print(f"UPDATE: {'✅' if results['update'] and results['update'].get('success') else '❌'}")
        print(f"DELETE: {'✅' if results['delete'] and results['delete'].get('success') else '❌'}")
        
        return results
        
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == '__main__':
    run_crud_test()
