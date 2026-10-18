"""Render bilingual product films from documented screenshot sources.

Requires Pillow and ffmpeg. This script never starts DSH or loads a plugin.
See docs/MEDIA.md for the source version and crop history of every image.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import argparse, math, os, subprocess, wave, array

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS, SECONDS = 1920, 1080, 24, 36
INK, MUTED, BLUE = '#172641', '#65738a', '#416bff'

def font_path(cjk=False, bold=False):
    env = os.environ.get('PROMO_FONT_CJK' if cjk else 'PROMO_FONT')
    candidates = [env] if env else []
    candidates += (['/System/Library/Fonts/STHeiti Medium.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'] if cjk else
        ['/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'])
    for path in candidates:
        if path and Path(path).exists(): return path
    raise RuntimeError('Set PROMO_FONT and PROMO_FONT_CJK to installed fonts.')

def f(size, zh=False, bold=False): return ImageFont.truetype(font_path(zh,bold),size)
def text(im,xy,value,size=30,color=INK,zh=False,bold=False):
    ImageDraw.Draw(im).multiline_text(xy,value,font=f(size,zh,bold),fill=color,spacing=14)

def background():
    im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
    for y in range(H):
        u=y/H;d.line((0,y,W,y),fill=(round(248-13*u),round(250-10*u),255))
    for x in range(66,W,36):
        for y in range(65,H,36): d.ellipse((x,y,x+1,y+1),fill='#dde5f4')
    return im
BG=background()

def card(im,source,box,radius=24):
    x,y,w,h=box
    shadow=Image.new('RGBA',(W,H));ImageDraw.Draw(shadow).rounded_rectangle((x,y+10,x+w,y+h+10),radius,fill=(40,63,110,25))
    shadow=shadow.filter(ImageFilter.GaussianBlur(20));im.paste(shadow,(0,0),shadow)
    view=source.resize((w,h),Image.Resampling.LANCZOS)
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius,fill=255)
    im.paste(view,(x,y),mask)
    ImageDraw.Draw(im).rounded_rectangle((x,y,x+w,y+h),radius,outline='#dfe6f1',width=2)

def pill(im,xy,label,zh=False):
    x,y=xy;width=round(ImageDraw.Draw(im).textlength(label,font=f(25,zh)))+46
    ImageDraw.Draw(im).rounded_rectangle((x,y,x+width,y+52),26,fill='white',outline='#dce5f6')
    text(im,(x+23,y+12),label,25,zh=zh);return width

def keycap(im,xy,label,scale=1):
    x,y=xy;w,h=round(196*scale),round(118*scale);d=ImageDraw.Draw(im)
    d.rounded_rectangle((x+4,y+8,x+w+4,y+h+8),22,fill='#c7d3fc')
    d.rounded_rectangle((x,y,x+w,y+h),22,fill='white',outline='#9eb5ff',width=3)
    ft=f(round(46*scale),bold=True);b=d.textbbox((0,0),label,font=ft)
    d.text((x+(w-b[2])/2,y+(h-(b[3]-b[1]))/2-b[1]),label,font=ft,fill=BLUE)

def source(path): return Image.open(ROOT/'media'/path).convert('RGB')
def optimizer(): return source('shared/05-prompt-optimized.png').crop((468,492,1245,608))
def footer(im,lang):
    text(im,(112,1033),'DSH COMMUNITY PLUGIN  /  v0.3.0',20,MUTED,bold=True)
    text(im,(1050,1033),'固定演示数据 · 模型调用消耗额度' if lang=='zh' else 'Scripted demo · Model requests use your quota',20,MUTED,zh=lang=='zh')

COPY={
 'zh':{
  'headline':'接上下一步。\n写清你的指令。','sub':'灰字建议，Tab 接受。草稿优化，点一下魔法棒。',
  'features':['Tab 接受','点击优化','自己发送'],
  'stages':[
   ('灰字出现，思路接上。','根据最近对话，建议下一条消息。'),
   ('按 Tab，变成你的草稿。','也可以按 Esc 忽略，或直接输入自己的消息。'),
   ('写好草稿？点一下魔法棒。','优化表述，保留原意；使用你已配置的模型。'),
   ('结果仍可编辑。发送由你决定。','优化不会提交消息。失败时保留原稿。'),
   ('启停，统一在插件管理。','启用 dsh-next-step 即可使用两项功能；停用插件即可关闭。')],
  'original':'原始草稿（固定示例）',
  'draft':'Plan a small to-do app with add and delete actions.\nKeep the UI simple.',
  'action':'点击魔法棒图标', 'result':'优化后的可编辑草稿',
  'note':'示例使用脚本化模型响应，不代表真实模型质量或速度。',
 },
 'en':{
  'headline':'Find your next step.\nRefine your prompt.','sub':'Tab to accept a suggestion. Click the wand to refine a draft.',
  'features':['Tab to accept','Click to refine','You send'],
  'stages':[
   ('A suggestion, right where you type.','A possible next message, based on the recent conversation.'),
   ('Press Tab. Make it a draft.','Press Esc to dismiss, or write your own message.'),
   ('Have a draft? Click the wand.','Clarify the wording with your configured model.'),
   ('Still editable. You decide when to send.','Improvement does not submit a message. Errors keep your draft.'),
   ('Start and stop in Plugin Manager.','Enable dsh-next-step for both features. Disable the plugin to stop.')],
  'original':'ORIGINAL DRAFT / SCRIPTED EXAMPLE',
  'draft':'Plan a small to-do app with add and delete actions.\nKeep the UI simple.',
  'action':'Click the magic-wand icon', 'result':'THE IMPROVED, EDITABLE DRAFT',
  'note':'Scripted model responses; no live quality or speed claim.',
 }
}

def cover(lang,outro=False):
    zh=lang=='zh';c=COPY[lang];im=BG.copy()
    text(im,(112,72),'dsh-next-step',34,bold=True)
    text(im,(112,180),c['headline'],86,zh=zh,bold=True)
    text(im,(116,409),c['sub'],32,MUTED,zh=zh)
    text(im,(116,489),'提示词优化 · 真实界面' if zh else 'PROMPT IMPROVEMENT / ACTUAL UI',22,BLUE,zh=zh,bold=True)
    card(im,optimizer(),(112,540,1696,253))
    x=112
    for label in c['features']:x+=pill(im,(x,842),label,zh)+18
    if outro:
        text(im,(112,943),'github.com/Tieboyh/dsh-next-step',32,BLUE,bold=True)
        text(im,(112,1006),c['note'],23,MUTED,zh=zh)
    else: footer(im,lang)
    return im

def scene(lang,index):
    zh=lang=='zh';c=COPY[lang];im=BG.copy();d=ImageDraw.Draw(im)
    text(im,(112,65),'dsh-next-step',34,bold=True)
    text(im,(1650,74),f'{index+1:02d} / 05',24,BLUE,bold=True)
    d.line((112,120,1808,120),fill='#dbe4f4',width=2)
    text(im,(112,163),c['stages'][index][0],60,zh=zh,bold=True)
    text(im,(116,258),c['stages'][index][1],29,MUTED,zh=zh)
    if index<2:
        text(im,(116,425),'输入框文字区域' if zh else 'COMPOSER TEXT DETAIL',23,BLUE,zh=zh,bold=True)
        card(im,source(f'{lang}/0{index+1}-'+('inline-prediction.png' if index==0 else 'tab-accepted.png')),(112,490,1696,85))
        keycap(im,(1420,704),'Tab',1.15)
        text(im,(116,735),'接受后可修改，不自动发送。' if zh else 'An editable draft. Never sent automatically.',32,zh=zh)
    elif index in (2,3):
        text(im,(116,367),c['original'],22,MUTED,zh=zh,bold=True)
        text(im,(116,418),c['draft'],30)
        text(im,(116,563),c['result'],22,BLUE,zh=zh,bold=True)
        card(im,optimizer(),(112,615,1696,253))
        if index==2:
            # The outline annotates the real icon; it does not fabricate a UI state.
            x=112+(697-468)*1696/777;y=615+(584-492)*253/116
            d.ellipse((x-33,y-33,x+33,y+33),outline=BLUE,width=4)
            d.line((x+36,y,x+140,y+81),fill=BLUE,width=3)
            text(im,(x+155,y+61),c['action'],27,BLUE,zh=zh,bold=True)
    else:
        text(im,(116,390),'唯一的启停入口' if zh else 'ONE PLACE TO ENABLE OR DISABLE',24,BLUE,zh=zh,bold=True)
        manager=source('shared/06-plugin-manager.png')
        card(im,manager,(112,475,1696,round(1696*manager.height/manager.width)))
        text(im,(116,783),'输入框只保留操作图标。' if zh else 'The composer keeps the action icon.',32,zh=zh)
    footer(im,lang);return im

def audio(path):
    rate=44100;samples=array.array('h',[0])*(rate*SECONDS)
    for at in [.45,3.25,8.25,12.25,20.25,26.25,31.25]:
        for n in range(round(.38*rate)):
            t=n/rate;env=math.exp(-11*t)*min(1,t/.012)
            v=round(2200*env*(math.sin(2*math.pi*660*t)+.35*math.sin(2*math.pi*990*t)))
            k=round(at*rate)+n
            if k<len(samples):samples[k]+=v
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(samples.tobytes())

def render(lang,work):
    out=ROOT/'media'/lang;intro=cover(lang);intro.save(out/f'cover-{lang}.png')
    stages=[intro]+[scene(lang,i) for i in range(5)]+[cover(lang,True)]
    starts=[0,3,8,12,20,26,31]
    wav=work/f'chimes-{lang}.wav';audio(wav)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(wav),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-t',str(SECONDS),str(out/f'promo-{lang}.mp4')]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for n in range(SECONDS*FPS):
        t=n/FPS;i=max(k for k,v in enumerate(starts) if t>=v);im=stages[i]
        if i and t-starts[i]<.42:
            u=(t-starts[i])/.42;u=u*u*(3-2*u);im=Image.blend(stages[i-1],stages[i],u)
        else:im=im.copy()
        ImageDraw.Draw(im).rectangle((0,H-5,round(W*(n+1)/(SECONDS*FPS)),H),fill=BLUE)
        proc.stdin.write(im.tobytes())
    proc.stdin.close()
    if proc.wait():raise RuntimeError('ffmpeg failed')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','3','-t','28','-i',str(out/f'promo-{lang}.mp4'),'-filter_complex','fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5','-loop','0',str(out/f'demo-{lang}.gif')],check=True)
    for i,im in enumerate(stages):im.resize((640,360)).save(work/f'{lang}-stage-{i}.jpg')
    print(lang,'rendered',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--lang',choices=['en','zh','both'],default='both');p.add_argument('--work-dir',type=Path,required=True);a=p.parse_args();a.work_dir.mkdir(parents=True,exist_ok=True)
    for lang in (['en','zh'] if a.lang=='both' else [a.lang]):render(lang,a.work_dir)
