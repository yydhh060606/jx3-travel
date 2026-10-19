# -*- coding: utf-8 -*-
"""
江湖行纪 · 音频素材生成
------------------------------------------------------------
不引用任何第三方录音，全部用合成方式生成，无版权顾虑：

  bgm.mp3     古筝 + 箫 + 碰铃 + 低音散音，五声音阶（D 宫），64 秒无缝循环
  tap.mp3     木鱼轻叩：按钮点击
  swish.mp3   纸页翻动：视图切换
  seal.mp3    落印：收藏 / 已行
  unseal.mp3  拆封：拆开信封

合成要点：
  · 古筝用 Karplus-Strong 弦模型（噪声激励 + 循环延迟 + 阻尼），
    衰减按 -60dB / 目标余音时长反推，不同音高余音一致
  · 箫用正弦 + 奇次泛音 + 慢颤音 + 气声噪声，起音软
  · 混响用合成脉冲响应（指数衰减噪声 + 早期反射）做卷积，尾巴折叠回开头实现无缝循环

用法：python _tools/make_audio.py
"""
import os
import numpy as np
import lameenc

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "audio")
rng = np.random.default_rng(20261019)

# D 宫五声：宫 商 角 徵 羽 → D E F# A B
NOTE = {
    "D2": 73.42, "A2": 110.00, "D3": 146.83, "E3": 164.81, "F#3": 185.00, "A3": 220.00, "B3": 246.94,
    "D4": 293.66, "E4": 329.63, "F#4": 369.99, "A4": 440.00, "B4": 493.88,
    "D5": 587.33, "E5": 659.25, "F#5": 739.99, "A5": 880.00,
}


# ---------------------------------------------------------------- 基础工具
def hz(name):
    return NOTE[name]


def lowpass(x, cutoff, sr=SR):
    """一阶低通（RC），用来压掉激励里过亮的成分。"""
    a = np.exp(-2.0 * np.pi * cutoff / sr)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def fade(x, ms_in=2, ms_out=8, sr=SR):
    n = len(x)
    a = min(int(sr * ms_in / 1000), n // 2)
    b = min(int(sr * ms_out / 1000), n // 2)
    if a:
        x[:a] *= np.linspace(0, 1, a) ** 1.4
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** 1.4
    return x


# ---------------------------------------------------------------- 古筝
def guzheng(freq, dur, amp=0.5, t60=2.6, bright=3400.0, pos=0.34, pluck_noise=0.22):
    """
    Karplus-Strong 拨弦。pos 是拨弦位置（占弦长比例），影响泛音分布；
    bright 控制激励的亮度，越小越闷（低音区更闷一点更像真筝）。
    """
    n = int(SR * dur)
    N = max(4, int(round(SR / freq)))

    # 激励：噪声 + 一点脉冲，低通后按拨弦位置做梳状衰减
    exc = rng.normal(0, 1, N)
    exc = lowpass(exc, bright)
    exc -= exc.mean()
    comb = np.ones(N)
    k = max(1, int(pos * N))
    comb[k:] = -0.7
    exc = np.convolve(exc, comb, mode="same")
    # 起音瞬间的指甲声
    exc[:6] += rng.normal(0, 3.0, 6) * pluck_noise
    exc /= (np.abs(exc).max() + 1e-9)

    # 每个周期 -60dB 衰减 → 余音长度与音高无关
    period_drop = 10 ** (-3.0 / max(1.0, t60 * freq))

    buf = np.zeros(n + N + 2)
    buf[:N] = exc
    prev = 0.0
    for i in range(N, n + N + 2):
        # 单点平均滤波（阻尼随频率升高而增强）
        v = buf[i - N]
        buf[i] = period_drop * (0.55 * v + 0.45 * prev)
        prev = v

    sig = buf[N:N + n].copy()
    # 筝体共鸣：低音区补一点 180Hz 附近的厚度
    if freq < 180:
        t = np.arange(n) / SR
        sig += 0.10 * np.sin(2 * np.pi * 172 * t) * np.exp(-t / 0.5)
    return fade(sig * amp, 1.5, 40)


# ---------------------------------------------------------------- 箫
def xiao(freq, dur, amp=0.3, breath=0.10):
    n = int(SR * dur)
    t = np.arange(n) / SR
    vib = 1.0 + 0.0055 * np.sin(2 * np.pi * 4.7 * t + rng.uniform(0, 6.28)) * np.clip(t / 0.8, 0, 1)
    phase = 2 * np.pi * freq * np.cumsum(vib) / SR
    # 箫的谐波：基音强，二次弱，三次以上很少
    tone = np.sin(phase) + 0.30 * np.sin(2 * phase) + 0.13 * np.sin(3 * phase) + 0.05 * np.sin(4 * phase)
    # 气声：带通噪声，跟着音量走
    air = rng.normal(0, 1, n)
    air = lowpass(air, 2600) - lowpass(air, 700)
    env = np.minimum(1.0, t / 0.10) * np.minimum(1.0, np.maximum(0.0, (dur - t) / 0.45))
    # 起音的一点气口
    chuff = rng.normal(0, 1, n) * np.exp(-t / 0.05) * 0.5
    sig = (tone * (1.0 + 0.04 * np.sin(2 * np.pi * 0.6 * t)) + air * breath * 3.0 + chuff * breath) * env
    return fade(sig * amp, 30, 120)


# ---------------------------------------------------------------- 碰铃
def bell(freq=1568.0, dur=3.2, amp=0.09):
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for ratio, dec, g in [(1.0, 0.9, 1.0), (2.76, 0.55, 0.45), (5.40, 0.35, 0.22), (8.93, 0.22, 0.11)]:
        sig += g * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / dec)
    sig *= np.minimum(1.0, t / 0.002)
    return fade(sig * amp, 1, 200)


# ---------------------------------------------------------------- 混响
def make_ir(seconds=2.6, tau=0.62, predelay=0.022):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, n) * np.exp(-t / tau)
    ir = lowpass(ir, 5200)
    # 早期反射，让空间有边界
    for d, g in [(0.011, 0.5), (0.019, 0.36), (0.031, 0.26), (0.047, 0.18)]:
        i = int(d * SR)
        if i < n:
            ir[i] += g * 2.2
    ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
    ir /= np.sqrt((ir ** 2).sum())
    return ir


def reverb(x, ir, wet=0.34):
    n = len(x) + len(ir) - 1
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:n]
    out = np.zeros(n)
    out[:len(x)] += x * (1 - wet)
    out += y * wet
    return out


# ---------------------------------------------------------------- 编曲
def build_bgm():
    bar = 4.0                      # 60 BPM，4/4
    bars = 16
    loop_len = bar * bars          # 64 s
    tail = 4.0                     # 尾巴，最后折叠回开头
    n = int(SR * (loop_len + tail))
    mix = np.zeros(n + SR * 2)

    def put(sig, at):
        i = int(at * SR)
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(len(mix), i + len(sig))
        mix[i:j] += sig[:j - i]

    # 主题旋律：(小节, 拍, 音, 时值, 力度)
    melody = [
        (0, 0, "A4", 2.0, .50), (0, 1.5, "B4", 1.5, .44), (0, 3, "D5", 1.2, .50),
        (1, 0, "A4", 3.0, .50),
        (2, 0, "F#4", 2.0, .46), (2, 2, "E4", 2.0, .44),
        (3, 0, "D4", 3.6, .48),
        (4, 0, "B4", 2.0, .50), (4, 2, "A4", 2.0, .44),
        (5, 0, "F#4", 3.2, .46),
        (6, 0, "E4", 2.0, .44), (6, 2, "F#4", 1.0, .40), (6, 3, "A4", 1.0, .46),
        (7, 0, "B4", 3.4, .50),
        (9, 0, "B4", 2.0, .46), (9, 2, "D5", 2.0, .50),
        (10, 0, "E5", 2.6, .48), (10, 2.5, "D5", 1.2, .44),
        (11, 0, "D5", 2.0, .46), (11, 2, "B4", 2.0, .44),
        (12, 0, "A4", 2.0, .44), (12, 2, "F#4", 2.0, .42),
        (13, 0, "E4", 3.0, .44),
        (14, 0, "F#4", 1.0, .40), (14, 1, "E4", 1.0, .38), (14, 2, "D4", 2.0, .44),
        (15, 0, "D4", 3.6, .46),
    ]
    for b, beat, name, dur, vel in melody:
        put(guzheng(hz(name), dur + 3.0, amp=vel, t60=4.4 if hz(name) < 400 else 3.8), b * bar + beat)

    # 低音散音：筝的低音区，撑住调性。每隔两小节一记，弱拍处半音量垫底
    for b, name, amp in [(0, "D2", .42), (2, "A2", .26), (4, "A2", .40), (6, "D2", .24),
                         (8, "D2", .42), (10, "A2", .26), (12, "A2", .40), (14, "D2", .24)]:
        put(guzheng(hz(name), 5.5, amp=amp, t60=4.6, bright=1200, pos=0.22), b * bar)

    # 呼应音：旋律长音底下补一两个低八度的回应，别让安静的乐句空掉
    for b, beat, name, amp in [(1, 2.4, "A3", .26), (2, 3.0, "D4", .22), (5, 2.6, "A3", .24),
                               (6, 3.2, "F#3", .22), (9, 3.0, "A3", .24), (10, 3.2, "B3", .22),
                               (13, 2.6, "A3", .24), (14, 3.0, "D3", .22)]:
        put(guzheng(hz(name), 2.0, amp=amp, t60=2.6), b * bar + beat)

    # 箫：在第 5 小节与第 13 小节进，影子式跟长音，别抢筝
    for b, name, dur in [(4, "F#4", 4.0), (5, "E4", 4.4), (6, "D4", 3.6), (7, "A3", 3.8),
                         (12, "A4", 4.0), (13, "F#4", 4.2), (14, "D4", 4.0), (15, "D4", 3.6)]:
        put(xiao(hz(name), dur, amp=.165), b * bar + 0.35)

    # 刮奏：第 9 小节前一拍，从 D4 爬到 D5
    run = ["D4", "E4", "F#4", "A4", "B4", "D5"]
    for k, name in enumerate(run):
        put(guzheng(hz(name), 1.4, amp=.30 + .02 * k, t60=1.8), 8 * bar + 3.3 + k * 0.085)

    # 碰铃：句首点一下
    put(bell(1568, 3.4, .075), 0.0)
    put(bell(1174.7, 3.6, .065), 8 * bar)

    # 混响
    wet = reverb(mix, make_ir())
    # 尾巴折叠回开头：循环点处不断层
    loop_n = int(loop_len * SR)
    body = wet[:loop_n].copy()
    over = wet[loop_n:loop_n + int(tail * SR)]
    if len(over):
        body[:len(over)] += over

    # 母带：去直流、压高频毛刺、软限幅
    body = body[::1]
    body = body - body.mean()
    body = np.tanh(body * 1.15) * 0.92
    body *= 0.62 / (np.abs(body).max() + 1e-9)
    return body


# ---------------------------------------------------------------- 音效
def sfx_tap():
    dur = 0.16
    n = int(SR * dur)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 880 * t) * np.exp(-t / 0.012)
    body = np.sin(2 * np.pi * 315 * t) * np.exp(-t / 0.030) * 0.55
    click = rng.normal(0, 1, n) * np.exp(-t / 0.0025) * 0.9
    click = lowpass(click, 6000)
    sig = thump * 0.7 + body + click * 0.45
    sig = reverb(sig, make_ir(0.5, 0.14, 0.008), wet=0.16)[:n]
    sig *= 0.55 / (np.abs(sig).max() + 1e-9)
    return fade(sig, 0.6, 12)


def sfx_swish():
    dur = 0.55
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    # 扫频带通：高频先落下来，像纸页掠过
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n
        c = 2600 * (1 - p) + 520
        s = noise[i:i + seg]
        out[i:i + len(s)] = lowpass(s, c) - lowpass(s, c * 0.45)
    env = np.minimum(1.0, t / 0.05) * np.exp(-np.maximum(0, t - 0.05) / 0.16)
    sig = out * env * 0.85
    sig += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.07) * 0.22
    sig = reverb(sig, make_ir(0.8, 0.2, 0.01), wet=0.22)[:n]
    sig *= 0.5 / (np.abs(sig).max() + 1e-9)
    return fade(sig, 2, 40)


def sfx_seal():
    dur = 0.62
    n = int(SR * dur)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * 132 * t + 2.2 * np.exp(-t / 0.02)) * np.exp(-t / 0.055)
    knock = np.sin(2 * np.pi * 520 * t) * np.exp(-t / 0.022) * 0.4
    grit = rng.normal(0, 1, n) * np.exp(-t / 0.006) * 0.5
    grit = lowpass(grit, 4200)
    tail = bell(1046.5, 0.6, 0.10)
    sig = thud + knock + grit * 0.5
    sig = reverb(sig, make_ir(1.1, 0.26, 0.012), wet=0.26)[:n]
    m = min(n, len(tail))
    sig[:m] += tail[:m]
    sig *= 0.58 / (np.abs(sig).max() + 1e-9)
    return fade(sig, 1, 40)


def sfx_unseal():
    """拆封：纸的撕裂 + 火漆裂开的一记脆响 + 一点铃。"""
    dur = 0.95
    n = int(SR * dur)
    t = np.arange(n) / SR
    tear = rng.normal(0, 1, n)
    tear = lowpass(tear, 5200) - lowpass(tear, 900)
    # 随机颗粒，模拟纤维一根根断开
    grain = np.zeros(n)
    pos = 0
    while pos < n:
        g = int(rng.uniform(0.004, 0.022) * SR)
        a = rng.uniform(0.3, 1.0)
        grain[pos:pos + g] = a
        pos += g + int(rng.uniform(0.002, 0.014) * SR)
    grain = np.convolve(grain, np.hanning(64) / 16, mode="same")
    sig = tear * grain
    sig += np.sin(2 * np.pi * 1568 * t) * np.exp(-np.maximum(0, t - 0.02) / 0.03) * 0.25
    sig += np.sin(2 * np.pi * 240 * t) * np.exp(-t / 0.05) * 0.3
    sig = reverb(sig, make_ir(1.4, 0.3, 0.014), wet=0.3)[:n]
    sig *= 0.55 / (np.abs(sig).max() + 1e-9)
    return fade(sig, 1, 80)


# ---------------------------------------------------------------- 编码
def to_mp3(x, path, bitrate=64):
    pcm = np.clip(x, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm.tobytes()) + enc.flush()
    with open(path, "wb") as f:
        f.write(bytes(data))
    return len(data)


def main():
    os.makedirs(OUT, exist_ok=True)
    print("合成 BGM …")
    bgm = build_bgm()
    size = to_mp3(bgm, os.path.join(OUT, "bgm.mp3"), 64)
    print("  bgm.mp3      %.1fs  %d KB  peak=%.2f rms=%.3f" % (
        len(bgm) / SR, size // 1024, np.abs(bgm).max(), np.sqrt((bgm ** 2).mean())))

    for name, fn, br in [("tap.mp3", sfx_tap, 96), ("swish.mp3", sfx_swish, 96),
                         ("seal.mp3", sfx_seal, 96), ("unseal.mp3", sfx_unseal, 96)]:
        sig = fn()
        s = to_mp3(sig, os.path.join(OUT, name), br)
        print("  %-11s %.2fs  %.1f KB  peak=%.2f" % (name, len(sig) / SR, s / 1024, np.abs(sig).max()))


if __name__ == "__main__":
    main()
