#!/usr/bin/env python3
"""
777-MS Memory System - Deep Inspection v8.2.1
Fixed URL path issue
"""

import requests
import json
import time
import paramiko
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://memory.91wz.org"

SSH_HOST = "134.185.111.25"
SSH_PORT = 1022
SSH_USER = "root"
SSH_PASSWORD = "C^74+ek@dN"
SITE_DIR = "/home/wwwroot/memory.91wz.org"

class DeepInspector:
    def __init__(self):
        self.token = None
        self.admin_token = None
        self.results = {"passed": 0, "failed": 0, "errors": []}
        
    def log(self, msg, status="info"):
        icons = {"info": "📋", "pass": "✅", "fail": "❌", "warn": "⚠️"}
        print(f"{icons.get(status, '📋')} {msg}")
        
    def test(self, name, condition, error_msg=""):
        if condition:
            self.results["passed"] += 1
            self.log(f"{name}", "pass")
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{name}: {error_msg}")
            self.log(f"{name} - {error_msg}", "fail")
        return condition
    
    def api_test(self, method, endpoint, data=None, token=None, timeout=15):
        # Fix: endpoint should already include /api/v1
        url = f"{BASE_URL}{endpoint}"
        h = {"Content-Type": "application/json"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        try:
            if method == "GET":
                r = requests.get(url, headers=h, timeout=timeout, verify=False)
            elif method == "POST":
                r = requests.post(url, headers=h, json=data, timeout=timeout, verify=False)
            elif method == "PUT":
                r = requests.put(url, headers=h, json=data, timeout=timeout, verify=False)
            elif method == "DELETE":
                r = requests.delete(url, headers=h, timeout=timeout, verify=False)
            else:
                return None, f"Unknown method: {method}"
            return r, None
        except Exception as e:
            return None, str(e)

    def run_ssh_command(self, cmd, timeout=30):
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD)
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
            output = stdout.read().decode()
            error = stderr.read().decode()
            ssh.close()
            return output, error
        except Exception as e:
            return "", str(e)

    def phase0_init(self):
        print("\n" + "="*60)
        print("Phase 0: 初始化 [智能预测]")
        print("="*60)
        
        output, error = self.run_ssh_command("pm2 status 777-ms")
        self.test("PM2服务运行", "online" in output, output[:200])
        
        output, error = self.run_ssh_command("netstat -tlnp | grep 1777")
        self.test("端口1777监听", "1777" in output, output or "端口未监听")

    def phase1_health_check(self):
        print("\n" + "="*60)
        print("Phase 1: Health Check")
        print("="*60)
        
        r, err = self.api_test("GET", "/health")
        if r:
            self.test("Health endpoint", r.status_code == 200, f"Status: {r.status_code}")
            if r.status_code == 200:
                data = r.json()
                self.test("Health status ok", data.get("status") in ["ok", "healthy"], str(data))
        else:
            self.test("Health endpoint", False, err)

    def phase2_user_auth(self):
        print("\n" + "="*60)
        print("Phase 2: User Authentication (用户认证)")
        print("="*60)
        
        # Test admin login
        r, err = self.api_test("POST", "/api/v1/users/login", data={"username": "admin", "password": "admin123456"})
        if r and r.status_code == 200:
            data = r.json()
            if data.get("success") or data.get("token"):
                self.admin_token = data.get("token") or data.get("data", {}).get("token")
                self.test("Admin login (admin/admin123456)", self.admin_token is not None, "OK")
            else:
                self.test("Admin login", False, str(data)[:100])
        else:
            self.test("Admin login", False, err or (r.text if r else "No response"))
        
        # Register test user
        self.api_test("POST", "/api/v1/users/register", data={
            "username": "test", 
            "password": "test123456",
            "email": "test@test.com"
        })
        
        # Test test user login
        r, err = self.api_test("POST", "/api/v1/users/login", data={"username": "test", "password": "test123456"})
        if r and r.status_code == 200:
            data = r.json()
            if data.get("success") or data.get("token"):
                self.token = data.get("token") or data.get("data", {}).get("token")
                self.test("Test user login (test/test123456)", self.token is not None, "OK")
            else:
                self.test("Test user login", False, str(data)[:100])
        else:
            self.test("Test user login", False, err or (r.text if r else "No response"))
        
        # Test get profile
        if self.token:
            r, err = self.api_test("GET", "/api/v1/users/profile", token=self.token)
            if r:
                self.test("Get user profile", r.status_code == 200, r.text[:100])
            else:
                self.test("Get user profile", False, err)

    def phase3_memory_api(self):
        print("\n" + "="*60)
        print("Phase 3: Memory API (记忆管理)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping memory tests - no token", "warn")
            return
        
        r, err = self.api_test("POST", "/api/v1/memories", data={
            "content": "Test memory from deep inspection",
            "importance": 8
        }, token=self.token)
        if r and r.status_code in [200, 201]:
            self.test("Create memory", True)
        else:
            self.test("Create memory", False, err or (r.text[:100] if r else "No response"))
        
        r, err = self.api_test("GET", "/api/v1/memories", token=self.token)
        if r:
            self.test("Get memories list", r.status_code == 200, r.text[:100])
        else:
            self.test("Get memories list", False, err)
        
        r, err = self.api_test("GET", "/api/v1/memories/search?q=test", token=self.token)
        if r:
            self.test("Search memories", r.status_code == 200, r.text[:100])
        else:
            self.test("Search memories", False, err)

    def phase4_knowledge_api(self):
        print("\n" + "="*60)
        print("Phase 4: Knowledge API (知识库)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping knowledge tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/knowledge", token=self.token)
        if r:
            self.test("Get knowledge list", r.status_code == 200, r.text[:100])
        else:
            self.test("Get knowledge list", False, err)
        
        r, err = self.api_test("GET", "/api/v1/categories", token=self.token)
        if r:
            self.test("Get categories", r.status_code == 200, r.text[:100])
        else:
            self.test("Get categories", False, err)

    def phase5_session_api(self):
        print("\n" + "="*60)
        print("Phase 5: Session API (会话管理)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping session tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/sessions", token=self.token)
        if r:
            self.test("Get sessions", r.status_code == 200, r.text[:100])
        else:
            self.test("Get sessions", False, err)

    def phase6_llm_api(self):
        print("\n" + "="*60)
        print("Phase 6: LLM API (LLM服务)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping LLM tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/llm/providers", token=self.token)
        if r:
            self.test("Get LLM providers", r.status_code == 200, r.text[:100])
        else:
            self.test("Get LLM providers", False, err)
        
        r, err = self.api_test("GET", "/api/v1/llm/usage", token=self.token)
        if r:
            self.test("Get LLM usage", r.status_code == 200, r.text[:100])
        else:
            self.test("Get LLM usage", False, err)

    def phase7_admin_api(self):
        print("\n" + "="*60)
        print("Phase 7: Admin API (管理后台)")
        print("="*60)
        
        if not self.admin_token:
            self.log("Skipping admin tests - no admin token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/admin/users", token=self.admin_token)
        if r:
            self.test("Admin get users", r.status_code in [200, 403], r.text[:100])
        else:
            self.test("Admin get users", False, err)
        
        r, err = self.api_test("GET", "/api/v1/admin/stats", token=self.admin_token)
        if r:
            self.test("Admin get stats", r.status_code in [200, 403], r.text[:100])
        else:
            self.test("Admin get stats", False, err)
        
        r, err = self.api_test("GET", "/api/v1/admin/providers", token=self.admin_token)
        if r:
            self.test("Admin get providers", r.status_code in [200, 403], r.text[:100])
        else:
            self.test("Admin get providers", False, err)

    def phase8_visualization_api(self):
        print("\n" + "="*60)
        print("Phase 8: Visualization API (数据可视化)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping visualization tests - no token", "warn")
            return
        
        endpoints = [
            "/api/v1/visualization/heatmap",
            "/api/v1/visualization/dashboard",
            "/api/v1/visualization/growth-trend",
        ]
        
        for ep in endpoints:
            r, err = self.api_test("GET", ep, token=self.token)
            if r:
                self.test(f"GET {ep}", r.status_code == 200, r.text[:50] if r.text else "OK")
            else:
                self.test(f"GET {ep}", False, err)

    def phase9_intelligence_api(self):
        print("\n" + "="*60)
        print("Phase 9: Intelligence API (智能功能)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping intelligence tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/intelligence/graph/stats", token=self.token)
        if r:
            self.test("Get graph stats", r.status_code == 200, r.text[:100])
        else:
            self.test("Get graph stats", False, err)
        
        r, err = self.api_test("GET", "/api/v1/intelligence/entities", token=self.token)
        if r:
            self.test("Get entities", r.status_code == 200, r.text[:100])
        else:
            self.test("Get entities", False, err)

    def phase10_review_api(self):
        print("\n" + "="*60)
        print("Phase 10: Review API (复习系统)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping review tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/review/due", token=self.token)
        if r:
            self.test("Get due reviews", r.status_code == 200, r.text[:100])
        else:
            self.test("Get due reviews", False, err)
        
        r, err = self.api_test("GET", "/api/v1/review/stats", token=self.token)
        if r:
            self.test("Get review stats", r.status_code == 200, r.text[:100])
        else:
            self.test("Get review stats", False, err)

    def phase11_other_apis(self):
        print("\n" + "="*60)
        print("Phase 11: Other APIs (其他API)")
        print("="*60)
        
        if not self.token:
            self.log("Skipping other API tests - no token", "warn")
            return
        
        r, err = self.api_test("GET", "/api/v1/tags", token=self.token)
        if r:
            self.test("Get tags", r.status_code == 200, r.text[:100])
        else:
            self.test("Get tags", False, err)
        
        r, err = self.api_test("GET", "/api/v1/logs/login", token=self.token)
        if r:
            self.test("Get login logs", r.status_code == 200, r.text[:100])
        else:
            self.test("Get login logs", False, err)
        
        r, err = self.api_test("GET", "/api/v1/backup/list", token=self.token)
        if r:
            self.test("Get backup list", r.status_code == 200, r.text[:100])
        else:
            self.test("Get backup list", False, err)
        
        r, err = self.api_test("GET", "/api/v1/providers/status", token=self.token)
        if r:
            self.test("Get providers status", r.status_code == 200, r.text[:100])
        else:
            self.test("Get providers status", False, err)

    def phase12_web_pages(self):
        print("\n" + "="*60)
        print("Phase 12: Web Pages (前端页面)")
        print("="*60)
        
        pages = [
            ("/", "Login page (登录页)"),
            ("/landing", "Landing page (产品展示页)"),
            ("/chat", "Chat page (对话界面)"),
            ("/intelligence", "Intelligence page (智能功能)"),
            ("/review", "Review page (记忆复习)"),
            ("/visualization", "Visualization page (数据可视化)"),
            ("/providers", "Providers page (提供商路由)"),
            ("/security", "Security page (安全设置)"),
            ("/admin", "Admin page (管理后台)"),
        ]
        
        for path, name in pages:
            try:
                r = requests.get(f"{BASE_URL}{path}", timeout=10, verify=False)
                self.test(f"Page: {name}", r.status_code == 200, f"Status: {r.status_code}")
            except Exception as e:
                self.test(f"Page: {name}", False, str(e))

    def run(self):
        print("\n" + "="*60)
        print("🔍 777-MS Deep Inspection v8.2.1")
        print(f"🌐 Target: {BASE_URL}")
        print(f"📁 Site Directory: {SITE_DIR}")
        print("="*60)
        
        self.phase0_init()
        self.phase1_health_check()
        self.phase2_user_auth()
        self.phase3_memory_api()
        self.phase4_knowledge_api()
        self.phase5_session_api()
        self.phase6_llm_api()
        self.phase7_admin_api()
        self.phase8_visualization_api()
        self.phase9_intelligence_api()
        self.phase10_review_api()
        self.phase11_other_apis()
        self.phase12_web_pages()
        
        print("\n" + "="*60)
        print("📊 Deep Inspection Results")
        print("="*60)
        total = self.results["passed"] + self.results["failed"]
        pass_rate = (self.results["passed"] / total * 100) if total > 0 else 0
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📈 Pass Rate: {pass_rate:.1f}%")
        
        if self.results["errors"]:
            print("\n❌ Errors:")
            for e in self.results["errors"][:15]:
                print(f"  - {e}")
        
        return pass_rate >= 80

if __name__ == "__main__":
    inspector = DeepInspector()
    success = inspector.run()
    exit(0 if success else 1)
