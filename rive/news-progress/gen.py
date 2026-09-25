#!/usr/bin/env python3
"""Generates rive/news-progress/scene.rml. Run: python3 gen.py > scene.rml"""
import math

_id = [100]
def nid():
    _id[0] += 1
    return f"0:{_id[0]}"

TAU = 6.2831855
ACCENT = "FF4ADE80"
MUTED = "FF8F8F8F"
BORDER = "FF2B2B2B"
SURFACE = "FF1C2020"
CX = CY = 200
SLOT_R = 150
CORE_D = 84
N = 9

# ---------- ids ----------
AB, AB_STYLE, SM = "0:2", "0:3", "0:4"
VM, VM_INST = "0:10", "0:11"
P_PULSE, P_COUNT, P_PHASE, P_ACCENT = "0:12", "0:13", "0:14", "0:15"

def accent_bind():
    return f'<DataBindContext sourcePathIds="{VM}-{P_ACCENT}" propertyKey="37"/>'

def accent_color(name="Accent"):
    return f'<SolidColor colorValue="{ACCENT}" name="{name}">{accent_bind()}</SolidColor>'

out = []
w = out.append

# ---------- scene objects ----------
ids = {}
def reg(key):
    ids[key] = nid()
    return ids[key]

slots = []
for i in range(N):
    a = -math.pi / 2 + i * TAU / N
    slots.append((CX + SLOT_R * math.cos(a), CY + SLOT_R * math.sin(a)))

shapes = []
S = shapes.append

# Draw order: first declared paints on top.
# Ripple (top)
S(f'''<Shape x="{CX}" y="{CY}" opacity="0" name="Ripple" id="{reg('ripple')}">
    <Ellipse width="{CORE_D}" height="{CORE_D}" name="Path"/>
    <Stroke thickness="3" cap="round" name="Stroke" id="{reg('rippleStroke')}">{accent_color()}</Stroke>
</Shape>''')

# Core
S(f'''<Node x="{CX}" y="{CY}" name="CoreFlash" id="{reg('coreFlash')}">
    <Node name="CoreBreath" id="{reg('coreBreath')}">
        <Shape name="CoreHighlight" opacity="0.9" id="{reg('coreHi')}">
            <Ellipse width="{CORE_D*0.36:.1f}" height="{CORE_D*0.36:.1f}" name="Path"/>
            <Fill name="Fill"><SolidColor colorValue="{SURFACE}" name="C"/></Fill>
        </Shape>
        <Shape name="CoreAccent" id="{reg('coreAccent')}">
            <Ellipse width="{CORE_D}" height="{CORE_D}" name="Path"/>
            <Fill name="Fill">{accent_color()}</Fill>
        </Shape>
        <Shape name="CoreMuted" id="{reg('coreMuted')}">
            <Ellipse width="{CORE_D}" height="{CORE_D}" name="Path"/>
            <Fill name="Fill"><SolidColor colorValue="{MUTED}" name="C"/></Fill>
        </Shape>
        <Shape name="Glow" opacity="0.35" id="{reg('glow')}">
            <Ellipse width="{CORE_D+8}" height="{CORE_D+8}" name="Path"/>
            <Stroke thickness="34" name="Glow">{accent_color()}<Feather strength="30" name="Feather"/></Stroke>
        </Shape>
    </Node>
</Node>''')

# Comet on inner track
S(f'''<Shape x="{CX}" y="{CY}" name="Comet" id="{reg('comet')}">
    <Ellipse width="200" height="200" name="Path"/>
    <Stroke thickness="9" cap="round" name="CometGlow">{accent_color()}
        <Feather strength="10" name="Feather"/>
        <TrimPath start="0" end="0.16" name="Trim" id="{reg('cometTrimGlow')}"/>
    </Stroke>
    <Stroke thickness="4" cap="round" name="CometCrisp">{accent_color()}
        <TrimPath start="0" end="0.16" name="Trim" id="{reg('cometTrim')}"/>
    </Stroke>
</Shape>''')
S(f'''<Shape x="{CX}" y="{CY}" name="InnerTrack">
    <Ellipse width="200" height="200" name="Path"/>
    <Stroke thickness="2" name="Stroke"><SolidColor colorValue="{BORDER}" name="C"/></Stroke>
</Shape>''')

# Lit slots (above unlit)
lit = []
for i, (x, y) in enumerate(slots):
    lit.append(f'''<Node x="{x:.3f}" y="{y:.3f}" scaleX="0" scaleY="0" opacity="0" name="LitSlot{i+1}" id="{reg(f'lit{i}')}">
        <Shape opacity="0" name="Halo{i+1}" id="{reg(f'halo{i}')}">
            <Ellipse width="26" height="26" name="Path"/>
            <Stroke thickness="2.5" name="Stroke">{accent_color()}</Stroke>
        </Shape>
        <Shape name="LitAccent{i+1}" id="{reg(f'litAccent{i}')}">
            <Ellipse width="26" height="26" name="Path"/>
            <Stroke thickness="6" name="Glow">{accent_color()}<Feather strength="8" name="Feather"/></Stroke>
            <Fill name="Fill">{accent_color()}</Fill>
        </Shape>
        <Shape name="LitMuted{i+1}">
            <Ellipse width="26" height="26" name="Path"/>
            <Fill name="Fill"><SolidColor colorValue="{MUTED}" name="C"/></Fill>
        </Shape>
    </Node>''')
S(f'''<Node name="Lit" id="{reg('litGroup')}">
    ''' + "\n    ".join(lit) + '''
</Node>''')

unlit = []
for i, (x, y) in enumerate(slots):
    unlit.append(f'''<Shape x="{x:.3f}" y="{y:.3f}" name="Slot{i+1}">
        <Ellipse width="26" height="26" name="Path"/>
        <Fill name="Fill"><SolidColor colorValue="408F8F8F" name="C"/></Fill>
        <Stroke thickness="1.5" name="Stroke"><SolidColor colorValue="408F8F8F" name="C"/></Stroke>
    </Shape>''')
S('''<Node name="Slots">
    ''' + "\n    ".join(unlit) + '''
</Node>''')

# Completion ring over slot track (success)
S(f'''<Shape x="{CX}" y="{CY}" opacity="0" name="CompleteRing" id="{reg('complete')}">
    <Ellipse width="{SLOT_R*2}" height="{SLOT_R*2}" name="Path"/>
    <Stroke thickness="10" name="Glow">{accent_color()}<Feather strength="14" name="Feather"/>
        <TrimPath start="0" end="0" name="Trim" id="{reg('completeTrimGlow')}"/>
    </Stroke>
    <Stroke thickness="2.5" name="Crisp">{accent_color()}
        <TrimPath start="0" end="0" name="Trim" id="{reg('completeTrim')}"/>
    </Stroke>
</Shape>''')
S(f'''<Shape x="{CX}" y="{CY}" name="SlotTrack">
    <Ellipse width="{SLOT_R*2}" height="{SLOT_R*2}" name="Path"/>
    <Stroke thickness="2" name="Stroke"><SolidColor colorValue="{BORDER}" name="C"/></Stroke>
</Shape>''')

# ---------- animation helpers ----------
EASE_IO = '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
EASE_OUT = '<CubicEaseInterpolator x1="0.16" y1="1" x2="0.3" y2="1"/>'
EASE_SOFT = '<CubicEaseInterpolator x1="0.25" y1="0.55" x2="0.4" y2="1"/>'
EASE_BACK = '<CubicValueInterpolator x1="0.3" y1="{a}" x2="0.5" y2="{b}"/>'

def kf(frame, value, ease=None, kind="Double"):
    if ease is None:
        return f'<KeyFrame{kind} frame="{frame}" value="{value}" interpolationType="linear"/>'
    if ease == "hold":
        return f'<KeyFrame{kind} frame="{frame}" value="{value}" interpolationType="hold"/>'
    interp = {"io": EASE_IO, "out": EASE_OUT, "soft": EASE_SOFT}[ease]
    return f'<KeyFrame{kind} frame="{frame}" value="{value}" interpolationType="cubic">{interp}</KeyFrame{kind}>'

def anim(name, aid, duration, tracks, loop="oneShot"):
    """tracks: {objkey: {propKey: [kf strings]}}"""
    body = []
    for obj, props in tracks.items():
        pk = []
        for key, frames in props.items():
            pk.append(f'<KeyedProperty propertyKey="{key}">' + "".join(frames) + '</KeyedProperty>')
        body.append(f'<KeyedObject objectId="{ids[obj]}">' + "".join(pk) + '</KeyedObject>')
    return f'<LinearAnimation loopValue="{loop}" duration="{duration}" name="{name}" id="{aid}">\n' + \
        "\n".join("    " + b for b in body) + '\n</LinearAnimation>'

X, Y, ROT, SX, SY, OP = 13, 14, 15, 16, 17, 18
TRIM_END = 115
THICK = 47

def scale(frames):
    return {SX: frames, SY: frames}

anims = []

def lit_accent_tracks(value_frames):
    return {f'litAccent{i}': {OP: value_frames} for i in range(N)}

# Phase: Working (6s loop)
A_WORK = nid()
breath = [kf(0, 1, "io"), kf(90, 1.06, "io"), kf(180, 1, "io"), kf(270, 1.06, "io"), kf(360, 1)]
tr = {
    'comet': {ROT: [kf(0, 0), kf(360, 2 * TAU)], OP: [kf(0, 1, "hold")]},
    'cometTrim': {TRIM_END: [kf(0, 0.12, "io"), kf(90, 0.22, "io"), kf(180, 0.12, "io"), kf(270, 0.22, "io"), kf(360, 0.12)]},
    'cometTrimGlow': {TRIM_END: [kf(0, 0.12, "io"), kf(90, 0.22, "io"), kf(180, 0.12, "io"), kf(270, 0.22, "io"), kf(360, 0.12)]},
    'coreBreath': scale(breath),
    'glow': {OP: [kf(0, 0.25, "io"), kf(90, 0.5, "io"), kf(180, 0.25, "io"), kf(270, 0.5, "io"), kf(360, 0.25)]},
    'coreAccent': {OP: [kf(0, 1, "hold")]},
    'complete': {OP: [kf(0, 0, "hold")]},
    'completeTrim': {TRIM_END: [kf(0, 0, "hold")]},
    'completeTrimGlow': {TRIM_END: [kf(0, 0, "hold")]},
}
tr.update(lit_accent_tracks([kf(0, 1, "hold")]))
anims.append(anim("Working", A_WORK, 360, tr, "loop"))

# Phase: SuccessIn (1.3s)
A_SIN = nid()
tr = {
    'comet': {OP: [kf(0, 1, "io"), kf(24, 0)]},
    'complete': {OP: [kf(0, 0, "out"), kf(10, 0.8)]},
    'completeTrim': {TRIM_END: [kf(0, 0, "io"), kf(56, 1)]},
    'completeTrimGlow': {TRIM_END: [kf(0, 0, "io"), kf(56, 1)]},
    'coreBreath': scale([kf(0, 1, "out"), kf(34, 1.2, "io"), kf(78, 1)]),
    'glow': {OP: [kf(0, 0.3, "out"), kf(34, 0.95, "io"), kf(78, 0.55)]},
    'coreAccent': {OP: [kf(0, 1, "hold")]},
}
tr.update(lit_accent_tracks([kf(0, 1, "hold")]))
anims.append(anim("SuccessIn", A_SIN, 78, tr))

# Phase: SuccessRest (5s loop)
A_SREST = nid()
tr = {
    'comet': {OP: [kf(0, 0, "hold")]},
    'complete': {OP: [kf(0, 0.8, "io"), kf(150, 0.5, "io"), kf(300, 0.8)]},
    'completeTrim': {TRIM_END: [kf(0, 1, "hold")]},
    'completeTrimGlow': {TRIM_END: [kf(0, 1, "hold")]},
    'coreBreath': scale([kf(0, 1, "io"), kf(150, 1.035, "io"), kf(300, 1)]),
    'glow': {OP: [kf(0, 0.55, "io"), kf(150, 0.75, "io"), kf(300, 0.55)]},
    'coreAccent': {OP: [kf(0, 1, "hold")]},
}
tr.update(lit_accent_tracks([kf(0, 1, "hold")]))
anims.append(anim("SuccessRest", A_SREST, 300, tr, "loop"))

# Phase: FailedIn (1.2s)
A_FIN = nid()
tr = {
    'comet': {OP: [kf(0, 1, "io"), kf(50, 0)]},
    'complete': {OP: [kf(0, 0, "hold")]},
    'coreBreath': scale([kf(0, 1, "io"), kf(72, 0.9)]),
    'glow': {OP: [kf(0, 0.3, "io"), kf(60, 0)]},
    'coreAccent': {OP: [kf(0, 1, "io"), kf(72, 0)]},
}
tr.update(lit_accent_tracks([kf(0, 1, "io"), kf(72, 0)]))
anims.append(anim("FailedIn", A_FIN, 72, tr))

# Phase: FailedRest (8s slow loop)
A_FREST = nid()
tr = {
    'comet': {OP: [kf(0, 0, "hold")]},
    'complete': {OP: [kf(0, 0, "hold")]},
    'coreBreath': scale([kf(0, 0.9, "io"), kf(240, 0.93, "io"), kf(480, 0.9)]),
    'glow': {OP: [kf(0, 0, "hold")]},
    'coreAccent': {OP: [kf(0, 0, "hold")]},
}
tr.update(lit_accent_tracks([kf(0, 0, "hold")]))
anims.append(anim("FailedRest", A_FREST, 480, tr, "loop"))

# Pulse: idle + ripple
A_PIDLE = nid()
anims.append(anim("PulseIdle", A_PIDLE, 1, {}))
A_RIPPLE = nid()
anims.append(anim("Ripple", A_RIPPLE, 84, {
    'ripple': {**scale([kf(0, 1, "soft"), kf(84, 3.55)]), OP: [kf(0, 0.85, "soft"), kf(84, 0)]},
    'rippleStroke': {THICK: [kf(0, 4, "soft"), kf(84, 1)]},
    'coreFlash': scale([kf(0, 1, "out"), kf(8, 1.12, "io"), kf(36, 1)]),
}))

# Slots
slot_anims = []
for i in range(N):
    off, arr, on = nid(), nid(), nid()
    anims.append(anim(f"Slot{i+1}Off", off, 1, {
        f'lit{i}': {**scale([kf(0, 0, "hold")]), OP: [kf(0, 0, "hold")]},
        f'halo{i}': {OP: [kf(0, 0, "hold")]},
    }))
    anims.append(anim(f"Slot{i+1}Arrive", arr, 48, {
        f'lit{i}': {
            SX: [kf(0, 0, "out"), kf(16, 1.3, "io"), kf(34, 1)],
            SY: [kf(0, 0, "out"), kf(16, 1.3, "io"), kf(34, 1)],
            OP: [kf(0, 0, "out"), kf(8, 1)],
        },
        f'halo{i}': {
            **scale([kf(0, 1, "out"), kf(48, 2.3)]),
            OP: [kf(0, 0, None), kf(4, 0.9, "out"), kf(48, 0)],
        },
    }))
    anims.append(anim(f"Slot{i+1}On", on, 1, {
        f'lit{i}': {**scale([kf(0, 1, "hold")]), OP: [kf(0, 1, "hold")]},
        f'halo{i}': {OP: [kf(0, 0, "hold")]},
    }))
    slot_anims.append((off, arr, on))

# ---------- state machine ----------
def num_cond(value, op):
    return f'''<TransitionViewModelCondition opValue="{op}">
    <TransitionPropertyViewModelComparator>
        <BindablePropertyNumber><DataBindContext sourcePathIds="{VM}-{{P}}" propertyKey="636"/></BindablePropertyNumber>
    </TransitionPropertyViewModelComparator>
    <TransitionValueNumberComparator value="{value}"/>
</TransitionViewModelCondition>'''

def phase_is(v):
    return num_cond(v, "equal").replace("{P}", P_PHASE)

def count_cmp(v, op):
    return num_cond(v, op).replace("{P}", P_COUNT)

def trigger_cond():
    return f'''<TransitionViewModelCondition>
    <TransitionPropertyViewModelComparator>
        <BindablePropertyTrigger><DataBindContext sourcePathIds="{VM}-{P_PULSE}" propertyKey="686"/></BindablePropertyTrigger>
    </TransitionPropertyViewModelComparator>
    <TransitionValueTriggerComparator/>
</TransitionViewModelCondition>'''

def trans(to, dur=0, cond="", exit_full=False):
    extra = ' enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"' if exit_full else ""
    return f'<StateTransition stateToId="{to}" duration="{dur}"{extra}>{cond}</StateTransition>'

def layer(name, entry_to, states):
    body = "\n".join(states)
    return f'''<StateMachineLayer name="{name}" id="{nid()}">
    <AnyState x="0" y="-160"/>
    <ExitState x="700" y="-160"/>
    <EntryState x="0" y="0">{trans(entry_to)}</EntryState>
{body}
</StateMachineLayer>'''

layers = []
# Phase layer
sW, sSI, sSR, sFI, sFR = nid(), nid(), nid(), nid(), nid()
layers.append(layer("Phase", sW, [
    f'<AnimationState x="200" y="0" animationId="{A_WORK}" id="{sW}">' +
    trans(sSI, 350, phase_is(1)) + trans(sFI, 450, phase_is(2)) + '</AnimationState>',
    f'<AnimationState x="400" y="-80" animationId="{A_SIN}" reset="true" id="{sSI}">' +
    trans(sSR, 0, exit_full=True) + trans(sW, 500, phase_is(0)) + trans(sFI, 450, phase_is(2)) + '</AnimationState>',
    f'<AnimationState x="600" y="-80" animationId="{A_SREST}" id="{sSR}">' +
    trans(sW, 500, phase_is(0)) + trans(sFI, 450, phase_is(2)) + '</AnimationState>',
    f'<AnimationState x="400" y="80" animationId="{A_FIN}" reset="true" id="{sFI}">' +
    trans(sFR, 0, exit_full=True) + trans(sW, 500, phase_is(0)) + trans(sSI, 350, phase_is(1)) + '</AnimationState>',
    f'<AnimationState x="600" y="80" animationId="{A_FREST}" id="{sFR}">' +
    trans(sW, 500, phase_is(0)) + trans(sSI, 350, phase_is(1)) + '</AnimationState>',
]))

# Pulse layer: two ripple states so back-to-back pulses restart the ripple
sPI, sRA, sRB = nid(), nid(), nid()
layers.append(layer("Pulse", sPI, [
    f'<AnimationState x="200" y="0" animationId="{A_PIDLE}" id="{sPI}">' + trans(sRA, 0, trigger_cond()) + '</AnimationState>',
    f'<AnimationState x="400" y="-80" animationId="{A_RIPPLE}" reset="true" id="{sRA}">' +
    trans(sRB, 0, trigger_cond()) + trans(sPI, 0, exit_full=True) + '</AnimationState>',
    f'<AnimationState x="400" y="80" animationId="{A_RIPPLE}" reset="true" id="{sRB}">' +
    trans(sRA, 0, trigger_cond()) + trans(sPI, 0, exit_full=True) + '</AnimationState>',
]))

# Slot layers
for i, (off, arr, on) in enumerate(slot_anims):
    k = i + 1
    so, sa, sn = nid(), nid(), nid()
    layers.append(layer(f"Slot{k}", so, [
        f'<AnimationState x="200" y="0" animationId="{off}" id="{so}">' + trans(sa, 0, count_cmp(k - 0.5, "greaterThanOrEqual")) + '</AnimationState>',
        f'<AnimationState x="400" y="-80" animationId="{arr}" reset="true" id="{sa}">' +
        trans(sn, 0, exit_full=True) + trans(so, 250, count_cmp(k - 0.5, "lessThan")) + '</AnimationState>',
        f'<AnimationState x="600" y="0" animationId="{on}" id="{sn}">' + trans(so, 350, count_cmp(k - 0.5, "lessThan")) + '</AnimationState>',
    ]))

# ---------- emit ----------
w('<Rive version="1" kind="fragment">')
w(f'<Artboard defaultStateMachineId="{SM}" styleId="{AB_STYLE}" viewModelId="{VM}" viewModelInstanceId="{VM_INST}" width="400" height="400" name="Progress" id="{AB}">')
w(f'<LayoutComponentStyle name="Artboard Style" id="{AB_STYLE}"/>')
for s in shapes:
    w(s)
for a in anims:
    w(a)
w(f'<StateMachine name="Progress" id="{SM}">')
for l in layers:
    w(l)
w('</StateMachine>')
w('</Artboard>')
w(f'''<ViewModel defaultInstanceId="{VM_INST}" name="Progress" id="{VM}">
    <ViewModelPropertyTrigger name="pulse" id="{P_PULSE}"/>
    <ViewModelPropertyNumber name="count" id="{P_COUNT}"/>
    <ViewModelPropertyNumber name="phase" id="{P_PHASE}"/>
    <ViewModelPropertyColor name="accent" id="{P_ACCENT}"/>
    <ViewModelInstance exports="true" name="Default" id="{VM_INST}">
        <ViewModelInstanceTrigger viewModelPropertyId="{P_PULSE}"/>
        <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{P_COUNT}"/>
        <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{P_PHASE}"/>
        <ViewModelInstanceColor propertyValue="{ACCENT}" viewModelPropertyId="{P_ACCENT}"/>
    </ViewModelInstance>
</ViewModel>''')
w('</Rive>')
print("\n".join(out))
