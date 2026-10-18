"""Render bilingual launch films from the real, unaltered UI screenshot files.
Requires Pillow and ffmpeg. Screenshots remain untouched; crops are used only
inside the promotional composition. No generated UI or third-party music.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import argparse, math, os, subprocess, wave, array

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS, SECONDS = 1920, 1080, 24, 28
INK, MUTED, BLUE = '#172641', '#65738a', '#416bff'

def font_path(cjk=False, bold=False):
    env = os.environ.get('PROMO_FONT_CJK' if cjk else 'PROMO_FONT')
    candidates = [env] if env else []
    candidates += (['/System/Library/Fonts/STHeiti Medium.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'] if cjk else
        ['/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'])
    for p in candidates:
        if p and Path(p).exists(): return p
    raise RuntimeError('Set PROMO_FONT and PROMO_FONT_CJK to installed fonts.')

def f(size, zh=False, bold=False): return ImageFont.truetype(font_path(zh, bold), size)
def text(im, xy, value, size=30, color=INK, zh=False, bold=False):
    ImageDraw.Draw(im).multiline_text(xy, value, font=f(size,zh,bold), fill=color, spacing=14)

def background():
    im=Image.new('RGB',(W,H))
    d=ImageDraw.Draw(im)
    for y in range(H):
        u=y/H
        d.line((0,y,W,y),fill=(round(248-13*u),round(250-10*u),255))
    for x in range(66,W,36):
        for y in range(65,H,36): d.ellipse((x,y,x+1,y+1),fill='#dde5f4')
    return im
BG=background()

def card(im, source, box, radius=24):
    x,y,w,h=box
    shadow=Image.new('RGBA',(W,H)); sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x,y+10,x+w,y+h+10),radius,fill=(40,63,110,25))
    im.paste(Image.alpha_composite(Image.new('RGBA',(W,H)),shadow.filter(ImageFilter.GaussianBlur(20))), (0,0), shadow.filter(ImageFilter.GaussianBlur(20)))
    view=source.resize((w,h),Image.Resampling.LANCZOS)
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius,fill=255)
    im.paste(view,(x,y),mask)
    ImageDraw.Draw(im).rounded_rectangle((x,y,x+w,y+h),radius,outline='#dfe6f1',width=2)

def pill(im,xy,label,zh=False):
    x,y=xy; width=round(ImageDraw.Draw(im).textlength(label,font=f(25,zh)))+46
    ImageDraw.Draw(im).rounded_rectangle((x,y,x+width,y+52),26,fill='#ffffff',outline='#dce5f6',width=1)
    text(im,(x+23,y+12),label,25,zh=zh)
    return width

def keycap(im,xy,label,scale=1.0):
    x,y=xy; w,h=round(196*scale),round(118*scale)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x+4,y+8,x+w+4,y+h+8),22,fill='#c7d3fc')
    d.rounded_rectangle((x,y,x+w,y+h),22,fill='white',outline='#9eb5ff',width=3)
    ft=f(round(46*scale),bold=True)
    bbox=d.textbbox((0,0),label,font=ft)
    d.text((x+(w-bbox[2])/2,y+(h-(bbox[3]-bbox[1]))/2-bbox[1]),label,font=ft,fill=BLUE)

def footer(im,lang):
    text(im,(112,1033),'COMMUNITY PLUGIN  /  DSH DESKTOP + WEB',20,MUTED,bold=True)
    text(im,(1436,1033),'dsh-next-step  v0.2.0',20,MUTED)

COPY={
 'zh':{
  'headline':'下一步，\n按下 Tab。','sub':'输入框里的灰字建议。发什么，由你决定。',
  'features':['Tab 接受','Esc 忽略','自己发送'],
  'stages':[
    ('灰字出现，思路接上。','根据最近对话，建议下一条消息。'),
    ('按 Tab，变成你的草稿。','接受建议，不会自动发送。'),
    ('改一改，再发送。','最终的指令，始终由你决定。'),
    ('不合适？Esc 跳过。','也可以直接输入自己的消息。')],
  'note':'演示使用固定示例数据 · 生成建议会额外消耗模型额度',
 },
 'en':{
  'headline':'Your next step.\nOne Tab away.','sub':'Inline predictions. You decide what to send.',
  'features':['Tab to accept','Esc to dismiss','You send'],
  'stages':[
    ('A suggestion, right where you type.','A possible next message, based on the recent conversation.'),
    ('Press Tab. Make it a draft.','Acceptance does not send your message.'),
    ('Edit first. Send when ready.','The final instruction is always yours.'),
    ('Not this one? Press Esc.','Or simply start writing your own message.')],
  'note':'Scripted demo data · Predictions use your model service quota',
 }
}

def cover(lang,outro=False):
    zh=lang=='zh'; c=COPY[lang]; im=BG.copy(); d=ImageDraw.Draw(im)
    text(im,(112,72),'dsh-next-step',34,INK,bold=True)
    text(im,(112,186),c['headline'],100,INK,zh=zh,bold=True)
    text(im,(116,441),c['sub'],36,MUTED,zh=zh)
    keycap(im,(1490,224),'Tab',1.45)
    source=Image.open(ROOT/'media'/lang/'01-inline-prediction.png').convert('RGB').crop((500,1260,1980,1470))
    card(im,source,(112,583,1696,241))
    x=112
    for label in c['features']: x+=pill(im,(x,871),label,zh)+18
    if outro:
        text(im,(112,965),'github.com/Tieboyh/dsh-next-step',32,BLUE,bold=True)
        text(im,(112,1020),c['note'],22,MUTED,zh=zh)
    else: footer(im,lang)
    return im

def scene(lang,index,state):
    zh=lang=='zh';c=COPY[lang];im=BG.copy();d=ImageDraw.Draw(im)
    text(im,(112,65),'dsh-next-step',34,INK,bold=True)
    text(im,(1650,74),f'{index+1:02d} / 04',24,BLUE,bold=True)
    d.line((112,120,1808,120),fill='#dbe4f4',width=2)
    text(im,(112,163),c['stages'][index][0],66,INK,zh=zh,bold=True)
    text(im,(116,258),c['stages'][index][1],31,MUTED,zh=zh)
    source=Image.open(ROOT/'media'/lang/state).convert('RGB')
    response=source.crop((500,270,1980,675))
    card(im,response,(260,353,1400,383))
    composer=source.crop((500,1260,1980,1470))
    card(im,composer,(112,769,1696,241))
    if index in (1,3): keycap(im,(1530,610),'Tab' if index==1 else 'Esc',.9)
    footer(im,lang)
    return im

def audio(path):
    rate=44100; samples=array.array('h',[0])*(rate*SECONDS)
    for at in [0.45,3.25,8.2,13.2,18.2,19.8,23.2]:
        for n in range(round(.38*rate)):
            t=n/rate;env=math.exp(-11*t)*min(1,t/.012)
            v=round(2200*env*(math.sin(2*math.pi*660*t)+.35*math.sin(2*math.pi*990*t)))
            k=round(at*rate)+n
            if k<len(samples): samples[k]+=v
    with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(samples.tobytes())

def render(lang,work):
    out=ROOT/'media'/lang
    intro=cover(lang);intro.save(out/f'cover-{lang}.png')
    stages=[intro,scene(lang,0,'01-inline-prediction.png'),scene(lang,1,'02-tab-accepted.png'),scene(lang,2,'03-edit-before-send.png'),scene(lang,3,'01-inline-prediction.png'),scene(lang,3,'04-esc-dismissed.png'),cover(lang,True)]
    starts=[0,3,8,13,18,19.5,23]
    wav=work/'chimes.wav';audio(wav)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(wav),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-t',str(SECONDS),str(out/f'promo-{lang}.mp4')]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for n in range(SECONDS*FPS):
        t=n/FPS;i=max(k for k,v in enumerate(starts) if t>=v);im=stages[i]
        if i and t-starts[i]<.42:
            u=(t-starts[i])/.42;u=u*u*(3-2*u);im=Image.blend(stages[i-1],stages[i],u)
        else: im=im.copy()
        # Quiet motion: timeline progression, with no fabricated editor content.
        d=ImageDraw.Draw(im);d.rectangle((0,H-5,round(W*(n+1)/(SECONDS*FPS)),H),fill=BLUE)
        proc.stdin.write(im.tobytes())
    proc.stdin.close()
    if proc.wait():raise RuntimeError('ffmpeg failed')
    gif=out/f'demo-{lang}.gif'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','3','-t','15','-i',str(out/f'promo-{lang}.mp4'),'-filter_complex','fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5','-loop','0',str(gif)],check=True)
    for at in [1,5,10,15,20,25]:
        i=max(k for k,v in enumerate(starts) if at>=v);stages[i].resize((640,360)).save(work/f'{lang}-{at:02d}.jpg')
    print(lang,'rendered',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--lang',choices=['en','zh','both'],default='both');p.add_argument('--work-dir',type=Path,required=True);a=p.parse_args();a.work_dir.mkdir(parents=True,exist_ok=True)
    for lang in (['en','zh'] if a.lang=='both' else [a.lang]):render(lang,a.work_dir)
