#!/usr/bin/env python3
"""
创建PWA相关文件
"""

import paramiko
import json
import sys

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

MANIFEST_CONTENT = {
    "name": "777-MS Memory System",
    "short_name": "777-MS",
    "description": "AI辅助记忆管理系统 - 提供无限上下文的智能记忆管理",
    "start_url": "/dashboard",
    "display": "standalone",
    "background_color": "#0a0a0f",
    "theme_color": "#3b82f6",
    "orientation": "any",
    "scope": "/",
    "lang": "zh-CN",
    "icons": [
        {"src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
    ],
    "categories": ["productivity", "utilities"],
    "shortcuts": [
        {
            "name": "新建记忆",
            "short_name": "新建",
            "description": "创建新的记忆",
            "url": "/dashboard?action=new",
            "icons": [{"src": "/icons/icon-96.png", "sizes": "96x96"}]
        },
        {
            "name": "AI对话",
            "short_name": "对话",
            "description": "开始AI对话",
            "url": "/chat",
            "icons": [{"src": "/icons/icon-96.png", "sizes": "96x96"}]
        }
    ]
}

SERVICE_WORKER_CONTENT = '''
const CACHE_NAME = '777-ms-v1';
const STATIC_CACHE = '777-ms-static-v1';
const DYNAMIC_CACHE = '777-ms-dynamic-v1';

const STATIC_ASSETS = [
    '/',
    '/login',
    '/dashboard',
    '/chat',
    '/styles.css',
    '/manifest.json'
];

const CACHE_STRATEGIES = {
    cacheFirst: [
        /\\.css$/,
        /\\.js$/,
        /\\.png$/,
        /\\.jpg$/,
        /\\.svg$/,
        /\\.woff2?$/
    ],
    networkFirst: [
        /\\/api\\//
    ],
    staleWhileRevalidate: [
        /\\.html$/
    ]
};

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.origin !== location.origin) {
        return;
    }

    if (CACHE_STRATEGIES.networkFirst.some(pattern => pattern.test(url.pathname))) {
        event.respondWith(networkFirst(request));
    } else if (CACHE_STRATEGIES.cacheFirst.some(pattern => pattern.test(url.pathname))) {
        event.respondWith(cacheFirst(request));
    } else if (CACHE_STRATEGIES.staleWhileRevalidate.some(pattern => pattern.test(url.pathname))) {
        event.respondWith(staleWhileRevalidate(request));
    } else {
        event.respondWith(networkFirst(request));
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Cache first failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Network first failed, trying cache:', error);
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        return new Response(JSON.stringify({ error: 'Offline', success: false }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            const cache = caches.open(DYNAMIC_CACHE);
            cache.then(c => c.put(request, response.clone()));
        }
        return response;
    }).catch(() => cached);
    return cached || fetchPromise;
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
'''

def create_files():
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
        
        sftp = client.open_sftp()
        
        manifest_path = f"{CONFIG['remote_dir']}/web/manifest.json"
        with sftp.file(manifest_path, 'w') as f:
            json.dump(MANIFEST_CONTENT, f, ensure_ascii=False, indent=2)
        print(f"Created: {manifest_path}")
        
        sw_path = f"{CONFIG['remote_dir']}/web/sw.js"
        with sftp.file(sw_path, 'w') as f:
            f.write(SERVICE_WORKER_CONTENT)
        print(f"Created: {sw_path}")
        
        sftp.close()
        
        print("PWA files created successfully!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_files()
