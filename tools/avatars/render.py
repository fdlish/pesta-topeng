# Render 25 foto profil topeng ke public/avatars/<key>.webp
# Pakai: jalankan server (PORT=4430 node server.js), lalu: python3 tools/avatars/render.py [key ...]
import base64, os, sys, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
URL = os.environ.get('URL', 'http://localhost:4430')
OUT = os.path.join(ROOT, 'public', 'avatars'); os.makedirs(OUT, exist_ok=True)
studio = open(os.path.join(ROOT, 'tools', 'avatars', 'studio.js')).read()
html = '''<!doctype html><html><body style="margin:0;background:#000">
<script type="importmap">{ "imports": { "three": "/vendor/three/build/three.module.js", "three/addons/": "/vendor/three/examples/jsm/" } }</script>
<script type="module">import * as S from '/__studio.js'; window.S = S; window.ready = true;</script></body></html>'''
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page()
    p.on('pageerror', lambda e: print('PAGEERR', e))
    p.on('console', lambda m: m.type == 'error' and print('CONSOLE', m.text))
    p.route('**/__studio.html', lambda r: r.fulfill(body=html, content_type='text/html'))
    p.route('**/__studio.js', lambda r: r.fulfill(body=studio, content_type='text/javascript'))
    p.goto(URL + '/__studio.html'); p.wait_for_function('window.ready', timeout=30000)
    keys = sys.argv[1:] or p.evaluate('S.KEYS')
    for k in keys:
        t = time.time(); url = p.evaluate(f"S.render('{k}')")
        open(os.path.join(OUT, f'{k}.webp'), 'wb').write(base64.b64decode(url.split(',')[1]))
        print(k, f'{time.time() - t:.1f}s')
    b.close()
