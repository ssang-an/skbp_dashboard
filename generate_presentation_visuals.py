from __future__ import annotations

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSET = ROOT / "presentation_assets"
ASSET.mkdir(exist_ok=True)

W, H = 1920, 1080
NAVY = (5, 11, 24)
PANEL = (18, 31, 51)
PANEL2 = (25, 43, 70)
TEAL = (45, 212, 191)
BLUE = (139, 168, 255)
PURPLE = (167, 139, 250)
GOLD = (251, 191, 36)
RED = (251, 113, 133)
WHITE = (242, 247, 255)
MUTED = (140, 164, 196)

random.seed(42)

def gradient_bg():
    img = Image.new("RGB", (W, H), NAVY)
    pix = img.load()
    for y in range(H):
        for x in range(W):
            dx = (x - W * 0.78) / W
            dy = (y - H * 0.18) / H
            glow = max(0, 1 - math.sqrt(dx * dx + dy * dy) * 2.4)
            r = int(NAVY[0] + glow * 18)
            g = int(NAVY[1] + glow * 38)
            b = int(NAVY[2] + glow * 54)
            pix[x, y] = (r, g, b)
    return img

def rounded(draw, box, r=28, fill=PANEL, outline=(45, 62, 90), width=2):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def glow_line(layer, points, color, width=4):
    d = ImageDraw.Draw(layer)
    for w, alpha in [(14, 40), (8, 70), (width, 230)]:
        c = (*color, alpha)
        d.line(points, fill=c, width=w, joint="curve")

def draw_nodes(layer, pts, color=TEAL):
    d = ImageDraw.Draw(layer)
    for x, y in pts:
        for r, a in [(18, 30), (10, 70), (5, 240)]:
            d.ellipse((x-r, y-r, x+r, y+r), fill=(*color, a))

def draw_molecule(layer, cx, cy, scale=1.0, color=PURPLE):
    pts = []
    for i in range(8):
        ang = i * math.pi * 2 / 8 + 0.25
        pts.append((cx + math.cos(ang) * 95 * scale, cy + math.sin(ang) * 70 * scale))
    d = ImageDraw.Draw(layer)
    for i in range(len(pts)):
        d.line([pts[i], pts[(i+1)%len(pts)]], fill=(*color, 95), width=int(3*scale))
    extra = [(cx, cy), (cx+150*scale, cy-100*scale), (cx-150*scale, cy+95*scale)]
    for p in extra:
        nearest = min(pts, key=lambda q: (q[0]-p[0])**2 + (q[1]-p[1])**2)
        d.line([p, nearest], fill=(*color, 75), width=int(3*scale))
    for p in pts + extra:
        x, y = p
        d.ellipse((x-10*scale, y-10*scale, x+10*scale, y+10*scale), fill=(*color, 180))

def mini_dashboard(draw, x, y, w, h):
    rounded(draw, (x, y, x+w, y+h), 34, (13, 24, 41), (48, 69, 101), 2)
    # KPI cards
    for i in range(4):
        bx = x + 38 + i * ((w-90)/4)
        by = y + 52
        bw = (w-130)/4
        rounded(draw, (bx, by, bx+bw, by+105), 14, PANEL2, (49, 68, 99), 1)
        draw.rectangle((bx+18, by+68, bx+18+bw*0.45, by+80), fill=TEAL if i%2==0 else BLUE)
        draw.rectangle((bx+18, by+88, bx+18+bw*0.75, by+96), fill=(52, 68, 92))
    # charts
    for j in range(2):
        for i in range(3):
            bx = x + 38 + i * ((w-100)/3)
            by = y + 195 + j * 185
            bw = (w-125)/3
            rounded(draw, (bx, by, bx+bw, by+145), 14, (17, 29, 49), (49, 68, 99), 1)
            for k in range(4):
                ly = by + 35 + k*24
                draw.rectangle((bx+22, ly, bx+bw-35, ly+8), fill=(41, 56, 80))
                ww = random.randint(45, int(bw-55))
                draw.rectangle((bx+22, ly, bx+22+ww, ly+8), fill=[TEAL, BLUE, PURPLE, GOLD][(i+j+k)%4])
    # table bottom
    tx, ty = x+38, y+h-170
    rounded(draw, (tx, ty, x+w-38, y+h-38), 14, (16, 28, 47), (49, 68, 99), 1)
    for r in range(5):
        yy = ty + 24 + r*22
        draw.line((tx+20, yy, x+w-58, yy), fill=(45, 60, 86), width=1)
        for c in range(5):
            draw.rectangle((tx+26+c*150, yy+6, tx+90+c*150, yy+10), fill=(80, 104, 140))

def make_hero():
    img = gradient_bg().convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    # network background
    pts = [(random.randint(900, 1840), random.randint(90, 980)) for _ in range(28)]
    for i, p in enumerate(pts):
        for q in pts[i+1:]:
            dist = math.dist(p, q)
            if dist < 210:
                d.line([p, q], fill=(45, 212, 191, int(60*(1-dist/210))), width=2)
    draw_nodes(layer, pts[:18], TEAL)
    draw_molecule(layer, 340, 240, 1.1, PURPLE)
    mini_dashboard(d, 560, 225, 880, 560)
    # glowing rings
    for r, a in [(420, 16), (300, 25), (190, 40)]:
        d.ellipse((1260-r, 550-r, 1260+r, 550+r), outline=(45,212,191,a), width=3)
    layer = layer.filter(ImageFilter.GaussianBlur(0.15))
    img.alpha_composite(layer)
    img.convert("RGB").save(ASSET / "gen_hero_cockpit.png", quality=95)

def make_workflow():
    img = gradient_bg().convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    centers = [(290, 540), (670, 540), (1050, 540), (1430, 540), (1690, 540)]
    colors = [BLUE, GOLD, TEAL, PURPLE, TEAL]
    # connecting line
    glow_line(layer, centers, TEAL, 5)
    for idx, (cx, cy) in enumerate(centers):
        rounded(d, (cx-145, cy-125, cx+145, cy+125), 30, (17, 30, 50), (52, 72, 105), 2)
        # abstract icon in each box
        if idx == 0:  # reports
            for j in range(3):
                x = cx-70+j*36; y = cy-60+j*10
                d.rounded_rectangle((x,y,x+82,y+112), radius=8, fill=(33,48,74), outline=(76,96,130))
                for k in range(4): d.line((x+15,y+28+k*18,x+66,y+28+k*18), fill=(*MUTED,180), width=3)
        elif idx == 1:  # JSON blocks
            for j in range(5):
                d.rectangle((cx-80, cy-58+j*25, cx+80, cy-44+j*25), fill=(45, 60, 86))
                d.rectangle((cx-80, cy-58+j*25, cx-50+random.randint(0,80), cy-44+j*25), fill=colors[idx])
        elif idx == 2:  # dashboard cards
            for j in range(2):
                for k in range(2):
                    rounded(d, (cx-88+k*92, cy-68+j*76, cx-8+k*92, cy-8+j*76), 10, (30,45,70), (60,80,112), 1)
                    d.rectangle((cx-70+k*92, cy-35+j*76, cx-20+k*92, cy-27+j*76), fill=colors[idx])
        elif idx == 3:  # graph
            ps = [(cx+math.cos(i*2.2)*random.randint(35,90), cy+math.sin(i*2.2)*random.randint(35,90)) for i in range(10)]
            for i,p in enumerate(ps):
                for q in ps[i+1:]:
                    if math.dist(p,q)<95: d.line([p,q], fill=(*PURPLE,110), width=2)
            for p in ps: d.ellipse((p[0]-7,p[1]-7,p[0]+7,p[1]+7), fill=(*PURPLE,220))
        else:  # agent aura
            for r in [76, 54, 32]:
                d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=(*TEAL,110), width=4)
            d.polygon([(cx,cy-75),(cx+58,cy+45),(cx-58,cy+45)], outline=(*TEAL,210), fill=(45,212,191,30))
    # data particles
    for _ in range(120):
        x=random.randint(80,1840); y=random.randint(80,1000); a=random.randint(20,70)
        d.ellipse((x-2,y-2,x+2,y+2), fill=(139,168,255,a))
    img.alpha_composite(layer)
    img.convert("RGB").save(ASSET / "gen_workflow_pipeline.png", quality=95)

def make_agent():
    img = gradient_bg().convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    # left dashboard cards
    mini_dashboard(d, 120, 210, 720, 600)
    # right chat/evidence panel without text
    rounded(d, (1110, 120, 1780, 900), 40, (15, 27, 46), (54, 75, 110), 2)
    for j in range(4):
        y = 210 + j*145
        rounded(d, (1180, y, 1690-random.randint(0,120), y+85), 22, (27, 42, 67), (58, 78, 112), 1)
        d.rectangle((1215, y+28, 1550-random.randint(0,160), y+38), fill=[TEAL, BLUE, PURPLE, GOLD][j%4])
        d.rectangle((1215, y+52, 1640-random.randint(0,160), y+61), fill=(66, 82, 110))
    # central graph bridge
    pts = [(random.randint(820, 1160), random.randint(220, 820)) for _ in range(26)]
    for i,p in enumerate(pts):
        for q in pts[i+1:]:
            if math.dist(p,q)<145:
                d.line([p,q], fill=(45,212,191,70), width=2)
    draw_nodes(layer, pts, TEAL)
    # glowing connectors from dashboard to graph and graph to panel
    for y in [340, 520, 700]:
        glow_line(layer, [(820, y), (960, y-60+random.randint(-30,30)), (1110, y+random.randint(-35,35))], TEAL, 4)
    draw_molecule(layer, 1550, 790, 0.8, PURPLE)
    img.alpha_composite(layer)
    img.convert("RGB").save(ASSET / "gen_agent_evidence.png", quality=95)

if __name__ == "__main__":
    make_hero()
    make_workflow()
    make_agent()
    for name in ["gen_hero_cockpit.png", "gen_workflow_pipeline.png", "gen_agent_evidence.png"]:
        print(ASSET / name)
