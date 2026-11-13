#!/usr/bin/env python3
"""Build every human in the game from the CC0 MakeHuman base mesh.

    pip install numpy pyfqmr
    python3 tools/build_characters.py            # all characters
    python3 tools/build_characters.py sam madi   # just these

What it does, per character:
  1. morphs the base mesh with MakeHuman macro targets (gender / age / ethnicity mix)
  2. builds the default skeleton and poses the body with linear blend skinning
     (students are baked sitting at a desk; Madi is baked standing with long arms)
  3. grows clothes and hair out of the body surface (offset + smoothed shells),
     paints the face with vertex colours, adds eyeballs, brows and shoes
  4. simplifies the result and writes a rigged .glb with a small game skeleton

The MakeHuman base mesh, skeleton, weights and targets are CC0 and are fetched
on first run into tools/.mh_cache (see URLS below).
"""
import gzip
import json
import os
import struct
import sys
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".mh_cache")
OUT = os.path.join(ROOT, "assets", "models")
MH = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/"
MPFB = "https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/src/mpfb/data/targets/macrodetails/"
NB = 13380  # body vertices come first in base.obj; the rest are helpers / joint cubes
rng = np.random.default_rng(7)


# ----------------------------------------------------------------- data
def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print("  fetching", name)
        with urllib.request.urlopen(url, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def load_base():
    V, T = [], []
    grp = None
    for line in open(fetch(MH + "3dobjs/base.obj", "base.obj")):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("g "):
            grp = line.split()[1]
        elif line.startswith("f ") and grp == "body":
            i = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
            T.append([i[0], i[1], i[2]])
            if len(i) == 4:
                T.append([i[0], i[2], i[3]])
    return np.array(V), np.array(T, dtype=np.int64)


BASE_V, BASE_T = load_base()
SK = json.load(open(fetch(MH + "rigs/default.mhskel", "default.mhskel")))
WJ = json.load(open(fetch(MH + "rigs/default_weights.mhw", "default_weights.mhw")))["weights"]
PARENT = {b: d["parent"] for b, d in SK["bones"].items()}
BONES = []


def _order(b):
    if b in BONES:
        return
    if PARENT[b] is not None:
        _order(PARENT[b])
    BONES.append(b)


for _b in SK["bones"]:
    _order(_b)
BI = {b: i for i, b in enumerate(BONES)}
W = np.zeros((NB, len(BONES)), np.float32)
for _b, lst in WJ.items():
    for vi, w in lst:
        if vi < NB:
            W[vi, BI[_b]] = w
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)


def descendants(b):
    out = [b]
    for c, p in PARENT.items():
        if p == b:
            out += descendants(c)
    return out


FACE_BONES = descendants("head")
_TARGETS = {}


def load_target(name):
    if name not in _TARGETS:
        idx, d = [], []
        with gzip.open(fetch(MPFB + name + ".target.gz", name + ".target.gz"), "rt") as f:
            for line in f:
                p = line.split()
                if len(p) == 4 and not line.startswith("#"):
                    idx.append(int(p[0])); d.append([float(x) for x in p[1:]])
        _TARGETS[name] = (np.array(idx), np.array(d))
    return _TARGETS[name]


# ----------------------------------------------------------------- math
def norm(v):
    return v / (np.linalg.norm(v) + 1e-12)


def rot_axis(axis, ang):
    a = norm(np.asarray(axis, float))
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * (K @ K)


def rot_between(a, b):
    a, b = norm(a), norm(b)
    v = np.cross(a, b); c = float(a @ b); s = np.linalg.norm(v)
    if s < 1e-9:
        if c > 0:
            return np.eye(3)
        p = np.cross(a, [1, 0, 0])
        if np.linalg.norm(p) < 1e-6:
            p = np.cross(a, [0, 1, 0])
        return rot_axis(p, np.pi)
    return rot_axis(v / s, np.arctan2(s, c))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def vertex_normals(V, T):
    n = np.zeros_like(V)
    fn = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    for k in range(3):
        np.add.at(n, T[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def neighbors(n, T):
    nb = [set() for _ in range(n)]
    for a, b, c in T:
        nb[a].update((b, c)); nb[b].update((a, c)); nb[c].update((a, b))
    return nb


def laplacian(V, T, iters, lam=0.5, pin=None):
    """Simple umbrella smoothing; pin = per-vertex factor (0 keeps the vertex)."""
    n = len(V)
    E = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
    E = np.concatenate([E, E[:, ::-1]])
    deg = np.bincount(E[:, 0], minlength=n).astype(float)
    V = V.copy()
    for _ in range(iters):
        acc = np.zeros_like(V)
        np.add.at(acc, E[:, 0], V[E[:, 1]])
        avg = acc / np.maximum(deg, 1)[:, None]
        step = lam if pin is None else lam * pin[:, None]
        V += (avg - V) * step
    return V


def nearest(P, Q, chunk=2000):
    """index of the nearest point in Q for every point in P"""
    out = np.zeros(len(P), np.int64)
    for i in range(0, len(P), chunk):
        d = ((P[i:i + chunk, None, :] - Q[None, :, :]) ** 2).sum(-1)
        out[i:i + chunk] = d.argmin(1)
    return out


# ----------------------------------------------------------------- human
class Human:
    def __init__(self, targets):
        V = BASE_V.copy()
        for name, w in targets.items():
            if w:
                idx, d = load_target(name)
                V[idx] += w * d
        V[:, 1] -= V[:NB, 1].min()
        V *= 0.1  # decimetres -> metres, feet on y = 0
        self.Vall = V
        self.V = V[:NB].copy()
        self.T = BASE_T
        J = {k: V[v].mean(0) for k, v in SK["joints"].items()}
        self.head = {b: J[d["head"]] for b, d in SK["bones"].items()}
        self.tail = {b: J[d["tail"]] for b, d in SK["bones"].items()}
        self.N = vertex_normals(self.V, self.T)
        self.nb = None

    def rw(self, *prefixes):
        cols = [BI[b] for b in BONES if b.startswith(prefixes)]
        return W[:, cols].sum(1)

    def rw_list(self, names):
        return W[:, [BI[b] for b in names]].sum(1)

    def t_along(self, a, b):
        d = b - a
        return (self.V - a) @ d / (d @ d)

    def neighbors(self):
        if self.nb is None:
            self.nb = neighbors(NB, self.T)
        return self.nb

    def erode(self, mask, rings=1):
        nb = self.neighbors()
        m = mask.copy()
        for _ in range(rings):
            idx = np.where(m)[0]
            keep = np.array([all(m[j] for j in nb[i]) for i in idx])
            m2 = np.zeros_like(m); m2[idx[keep]] = True
            m = m2
        return m


class Pose:
    """Forward kinematics with per-bone rotation and stretch, plus skinning."""

    def __init__(self, h):
        self.h = h
        self.R = {b: np.eye(3) for b in BONES}
        self.S = {b: np.eye(3) for b in BONES}
        self.inherit = set()
        self.offset = np.zeros(3)
        self.solved = False

    def rot_world_parent(self, b):
        R = np.eye(3)
        chain = []
        p = PARENT[b]
        while p is not None:
            chain.append(p); p = PARENT[p]
        for c in reversed(chain):
            R = R @ self.R[c]
        return R

    def solve(self):
        h = self.h
        self.Rw, self.Se, self.P, self.L = {}, {}, {}, {}
        for b in BONES:
            p = PARENT[b]
            if p is None:
                self.Rw[b] = self.R[b]; self.Se[b] = self.S[b]; self.P[b] = h.head[b] + self.offset
            else:
                self.P[b] = self.L[p] @ (h.head[b] - h.head[p]) + self.P[p]
                self.Rw[b] = self.Rw[p] @ self.R[b]
                self.Se[b] = self.S[b] @ self.Se[p] if b in self.inherit else self.S[b]
            self.L[b] = self.Rw[b] @ self.Se[b]
        self.solved = True

    def aim(self, b, D, tail=None, keep=False):
        """Rotate bone b so its rest direction (head -> tail) points along world D."""
        h = self.h
        d0 = norm((h.tail[b] if tail is None else tail) - h.head[b])
        Rp = self.rot_world_parent(b)
        self.R[b] = rot_between(d0, Rp.T @ norm(np.asarray(D, float)))
        self.solved = False

    def twist_to(self, b, ref0, desired, tail=None):
        """Twist b about its own axis so rest vector ref0 ends up closest to world 'desired'."""
        h = self.h
        d0 = norm((h.tail[b] if tail is None else tail) - h.head[b])
        Rcur = self.rot_world_parent(b) @ self.R[b]
        u = ref0 - d0 * (ref0 @ d0)
        want = Rcur.T @ np.asarray(desired, float)
        want = want - d0 * (want @ d0)
        if np.linalg.norm(u) < 1e-6 or np.linalg.norm(want) < 1e-6:
            return
        u, want = norm(u), norm(want)
        ang = np.arctan2(np.cross(u, want) @ d0, u @ want)
        self.R[b] = self.R[b] @ rot_axis(d0, ang)
        self.solved = False

    def pos(self, b):
        if not self.solved:
            self.solve()
        return self.P[b]

    def point(self, b, rest_point):
        if not self.solved:
            self.solve()
        return self.L[b] @ (rest_point - self.h.head[b]) + self.P[b]

    def ik(self, b1, b2, end_rest, target, pole):
        """Two-bone IK: b1 (e.g. upperarm01) -> b2 (lowerarm01) -> end_rest point reaches target."""
        h = self.h
        self.solve()
        S = self.P[b1]
        L1 = np.linalg.norm(self.Se[b1] @ (h.head[b2] - h.head[b1]))
        L2 = np.linalg.norm(self.Se[b2] @ (end_rest - h.head[b2]))
        d = np.asarray(target, float) - S
        dist = np.clip(np.linalg.norm(d), 0.02, L1 + L2 - 1e-3)
        d = norm(d)
        a = np.arccos(np.clip((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1))
        p = np.asarray(pole, float) - S
        p = norm(p - d * (p @ d))
        E = S + d * np.cos(a) * L1 + p * np.sin(a) * L1
        self.aim(b1, E - S, tail=h.head[b2])
        self.aim(b2, (S + d * dist) - E, tail=end_rest)
        self.solved = False

    def skin(self, V, Wrows):
        if not self.solved:
            self.solve()
        out = np.zeros_like(V)
        for bi, b in enumerate(BONES):
            w = Wrows[:, bi]
            nz = w > 0
            if nz.any():
                out[nz] += w[nz, None] * ((V[nz] - self.h.head[b]) @ self.L[b].T + self.P[b])
        return out


# ----------------------------------------------------------------- parts
class Part:
    """A piece of geometry in rest space with full MakeHuman bone weights."""

    def __init__(self, name, V, T, Wr, C=None, material=None, double=False):
        self.name = name; self.V = V; self.T = np.asarray(T, np.int64)
        self.W = Wr
        self.C = np.ones((len(V), 3)) if C is None else C
        self.material = material or {}
        self.double = double


def body_part(h, name, vmask_faces, C, material):
    """Sub-mesh of the body: faces whose three vertices satisfy the mask."""
    T = h.T[vmask_faces[h.T].all(1)]
    idx = np.unique(T)
    remap = -np.ones(NB, np.int64); remap[idx] = np.arange(len(idx))
    return Part(name, h.V[idx].copy(), remap[T], W[idx].copy(), C[idx].copy(), material), idx


def shell(h, name, mask, offset, smooth=4, min_off=0.006, material=None, shape=None, color=None, double=False, hem_smooth=6):
    """Clothing / hair shell: body faces inside mask, pushed out along normals and smoothed."""
    T = h.T[mask[h.T].all(1)]
    idx = np.unique(T)
    remap = -np.ones(NB, np.int64); remap[idx] = np.arange(len(idx))
    T2 = remap[T]
    off = offset[idx] if isinstance(offset, np.ndarray) else np.full(len(idx), offset)
    V0 = h.V[idx]; N0 = h.N[idx]
    V = V0 + N0 * off[:, None]
    if shape is not None:
        V = shape(V, idx)
    # boundary vertices move less so hems stay where they were cut
    E = np.concatenate([T2[:, [0, 1]], T2[:, [1, 2]], T2[:, [2, 0]]])
    key = np.sort(E, 1); key = key[:, 0] * len(idx) + key[:, 1]
    uniq, cnt = np.unique(key, return_counts=True)
    bkeys = uniq[cnt == 1]
    bverts = np.unique(np.concatenate([bkeys // len(idx), bkeys % len(idx)]))
    pin = np.ones(len(idx)); pin[bverts] = 0.25
    if len(bkeys):
        be = np.stack([bkeys // len(idx), bkeys % len(idx)], 1)
        be = np.concatenate([be, be[:, ::-1]])
        deg = np.bincount(be[:, 0], minlength=len(idx)).astype(float)
        for _ in range(hem_smooth):
            acc = np.zeros_like(V); np.add.at(acc, be[:, 0], V[be[:, 1]])
            V[bverts] += 0.5 * (acc[bverts] / np.maximum(deg[bverts], 1)[:, None] - V[bverts])
    V = laplacian(V, T2, smooth, 0.5, pin)
    # never sink below the body surface
    d = ((V - V0) * N0).sum(1)
    low = d < min_off
    V[low] += N0[low] * (min_off - d[low])[:, None]
    C = np.ones((len(idx), 3)) if color is None else color(V, idx)
    return Part(name, V, T2, W[idx].copy(), C, material, double), idx


def rigid(name, V, T, bone, C, material=None, double=False):
    Wr = np.zeros((len(V), len(BONES)), np.float32); Wr[:, BI[bone]] = 1
    return Part(name, np.asarray(V, float), T, Wr, np.asarray(C, float), material, double)


def draped(h, name, pts_xy, T, lift, C, front, material=None, double=True):
    """Lay 2D points onto the front of surface 'front' (V, W) at +z, lifted a little."""
    FV, FW = front
    V = np.zeros((len(pts_xy), 3)); Wr = np.zeros((len(pts_xy), len(BONES)), np.float32)
    for i, (x, y) in enumerate(pts_xy):
        d2 = (FV[:, 0] - x) ** 2 + (FV[:, 1] - y) ** 2
        k = np.argsort(d2)[:4]
        w = 1 / (d2[k] + 1e-6)
        V[i] = [x, y, (FV[k, 2] * w).sum() / w.sum() + lift]
        Wr[i] = FW[k[0]]
    return Part(name, V, T, Wr, C, material, double)


def grid_tris(rows, cols):
    T = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            a = r * cols + c
            T += [[a, a + 1, a + cols + 1], [a, a + cols + 1, a + cols]]
    return np.array(T)


def make_eye(center, r, iris, bone):
    """Eyeball with pole forward (+z). Colour rings: pupil / iris / sclera."""
    th = [0.0, 0.10, 0.19, 0.195, 0.30, 0.44, 0.445, 0.75, 1.15, 1.6, 2.2]
    dark = np.array(iris) * 0.45
    col = [(0.02, 0.02, 0.02)] * 3 + [dark, iris, dark] + [(0.93, 0.92, 0.9), (0.93, 0.92, 0.9), (0.85, 0.8, 0.78), (0.8, 0.7, 0.68), (0.7, 0.6, 0.6)]
    seg = 12
    V, C = [], []
    for t, c in zip(th, col):
        for s in range(seg):
            a = 2 * np.pi * s / seg
            V.append(center + r * np.array([np.sin(t) * np.cos(a), np.sin(t) * np.sin(a), np.cos(t)]))
            C.append(c)
    T = []
    for ri in range(len(th) - 1):
        for s in range(seg):
            a = ri * seg + s; b = ri * seg + (s + 1) % seg
            T += [[a, b + seg, b], [a, a + seg, b + seg]]
    return rigid("eyes", V, np.array(T), bone, C)


def make_shoe(ankle, scale, bone, sole_y=0.0, colour=(1, 1, 1)):
    """Lofted shoe around the foot; ankle = ankle joint position (rest)."""
    prof = [(-0.075, 0.030, 0.085), (-0.05, 0.042, 0.10), (0.0, 0.047, 0.10), (0.06, 0.05, 0.075),
            (0.12, 0.052, 0.058), (0.165, 0.045, 0.045), (0.195, 0.03, 0.03), (0.21, 0.008, 0.012)]
    seg = 10
    V, C = [], []
    for z, hw, ht in prof:
        for s in range(seg):
            a = np.pi * s / (seg - 1)  # half ellipse over the top, flat sole
            x = np.cos(a) * hw * scale; y = np.sin(a) * ht * scale
            V.append([ankle[0] + x, sole_y + 0.004 + y, ankle[2] + z * scale])
            C.append(np.array(colour) * (0.55 if y < 0.012 * scale else 1.0))
    T = []
    n = len(prof)
    for r in range(n - 1):
        for s in range(seg - 1):
            a = r * seg + s
            T += [[a, a + seg, a + seg + 1], [a, a + seg + 1, a + 1]]
        T += [[r * seg + seg - 1, (r + 1) * seg + seg - 1, (r + 1) * seg], [r * seg + seg - 1, (r + 1) * seg, r * seg]]  # sole
    for s in range(1, seg - 1):  # heel cap
        T.append([0, s + 1, s])
    return rigid("shoes", V, np.array(T), bone, C)


# ----------------------------------------------------------------- GLB writer
def write_glb(path, joints, prims, extras=None):
    """joints: [(name, parent_index, world_pos)], prims: [dict(name,V,N,C,J,Wt,T,material,double)]"""
    buf = bytearray(); views = []; accessors = []

    def add(data, target=None):
        while len(buf) % 4:
            buf.append(0)
        v = {"buffer": 0, "byteOffset": len(buf), "byteLength": len(data)}
        if target:
            v["target"] = target
        buf.extend(data); views.append(v)
        return len(views) - 1

    def acc(arr, ctype, atype, target=None, normalized=False, minmax=False):
        a = {"bufferView": add(arr.tobytes(), target), "componentType": ctype, "count": len(arr), "type": atype}
        if normalized:
            a["normalized"] = True
        if minmax:
            a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accessors.append(a)
        return len(accessors) - 1

    materials, gprims = [], []
    for p in prims:
        m = p.get("material", {})
        materials.append({"name": p["name"], "doubleSided": bool(p.get("double")),
                          "pbrMetallicRoughness": {"baseColorFactor": list(m.get("color", (1, 1, 1))) + [1], "metallicFactor": m.get("metal", 0.0), "roughnessFactor": m.get("rough", 0.8)}})
        n = len(p["V"])
        idx = p["T"].astype(np.uint16 if n < 65536 else np.uint32).reshape(-1)
        col = np.concatenate([np.clip(p["C"], 0, 1), np.ones((n, 1))], 1)
        gprims.append({"attributes": {
            "POSITION": acc(p["V"].astype(np.float32), 5126, "VEC3", 34962, minmax=True),
            "NORMAL": acc(p["N"].astype(np.float32), 5126, "VEC3", 34962),
            "COLOR_0": acc((col * 255).round().astype(np.uint8), 5121, "VEC4", 34962, normalized=True),
            "JOINTS_0": acc(p["J"].astype(np.uint8), 5121, "VEC4", 34962),
            "WEIGHTS_0": acc(p["Wt"].astype(np.float32), 5126, "VEC4", 34962),
        }, "indices": acc(idx, 5123 if n < 65536 else 5125, "SCALAR", 34963), "material": len(materials) - 1})
    nodes = []
    for name, par, pos in joints:
        rel = pos - (joints[par][2] if par >= 0 else 0)
        nodes.append({"name": name, "translation": [float(x) for x in rel]})
    for i, (name, par, pos) in enumerate(joints):
        if par >= 0:
            nodes[par].setdefault("children", []).append(i)
    ibm = np.zeros((len(joints), 16), np.float32)
    for i, (_, _, pos) in enumerate(joints):
        m = np.eye(4, dtype=np.float32); m[:3, 3] = -pos
        ibm[i] = m.T.reshape(-1)  # column-major
    skin = {"joints": list(range(len(joints))), "inverseBindMatrices": acc(ibm, 5126, "MAT4"), "skeleton": 0}
    nodes.append({"name": "body", "mesh": 0, "skin": 0})
    roots = [i for i, j in enumerate(joints) if j[1] < 0] + [len(nodes) - 1]
    gltf = {"asset": {"version": "2.0", "generator": "madi-class build_characters.py"}, "scene": 0,
            "scenes": [{"nodes": roots, "extras": extras or {}}], "nodes": nodes,
            "meshes": [{"name": "body", "primitives": gprims}], "materials": materials, "skins": [skin],
            "buffers": [{"byteLength": len(buf)}], "bufferViews": views, "accessors": accessors}
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    while len(buf) % 4:
        buf.append(0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(buf), 0x004E4942)); f.write(buf)


def export(path, pose, parts, joint_spec, simplify=None, extras=None, transform=None, bake=None):
    """Skin every part into the pose, reduce weights to the game skeleton and write a GLB.
    joint_spec: [(name, parent_name, mh_bone_for_pivot, [mh bones it owns, '*' suffix = prefix])] (later entries win)
    bake: {part name: (output primitive, (r, g, b))} merges parts into few primitives with baked colours,
          so a whole character renders in one or two draw calls."""
    import pyfqmr
    pose.solve()
    names = [j[0] for j in joint_spec]
    owner = np.zeros(len(BONES), np.int64)
    for ji, (_, _, _, owns) in enumerate(joint_spec):
        for bi, b in enumerate(BONES):
            if any(b == o or (o.endswith("*") and b.startswith(o[:-1])) for o in owns):
                owner[bi] = ji
    M = np.zeros((len(BONES), len(joint_spec)), np.float32)
    M[np.arange(len(BONES)), owner] = 1
    tf = transform or (lambda P: P)
    joints = [(n, names.index(p) if p else -1, tf(pose.pos(b)[None, :])[0]) for n, p, b, _ in joint_spec]
    prims, total, report = {}, 0, []
    for part in parts:
        V = tf(pose.skin(part.V, part.W))
        Wg = part.W @ M
        T = part.T; C = part.C
        target = (simplify or {}).get(part.name)
        if target and len(T) > target * 1.15:
            s = pyfqmr.Simplify(); s.setMesh(V, T.astype(np.int32))
            s.simplify_mesh(target_count=int(target), aggressiveness=5, preserve_border=True, verbose=False)
            V2, T2, _ = s.getMesh()
            k = nearest(V2, V)
            V, T, C, Wg = V2, np.asarray(T2, np.int64), C[k], Wg[k]
        N = vertex_normals(V, T)
        if part.double:  # real back faces instead of a double-sided material
            n = len(V)
            V = np.concatenate([V, V]); N = np.concatenate([N, -N]); C = np.concatenate([C, C * 0.8]); Wg = np.concatenate([Wg, Wg])
            T = np.concatenate([T, T[:, ::-1] + n])
        if Wg.shape[1] < 4:  # glTF wants exactly 4 influences per vertex
            Wg = np.concatenate([Wg, np.zeros((len(Wg), 4 - Wg.shape[1]), Wg.dtype)], 1)
        order = np.argsort(-Wg, 1)[:, :4]
        Wt = np.take_along_axis(Wg, order, 1)
        Wt /= np.maximum(Wt.sum(1, keepdims=True), 1e-9)
        out, colour = (bake or {}).get(part.name, (part.name, (1, 1, 1)))
        C = np.clip(C * np.array(colour), 0, 1) ** 2.2  # colours are authored in sRGB; glTF vertex colours are linear
        report.append(f"{part.name}={len(T)}")
        total += len(T)
        if out in prims:
            q = prims[out]
            q["T"] = np.concatenate([q["T"], T + len(q["V"])])
            for k_, arr in (("V", V), ("N", N), ("C", C), ("J", order), ("Wt", Wt)):
                q[k_] = np.concatenate([q[k_], arr])
        else:
            prims[out] = {"name": out, "V": V, "N": N, "C": C, "J": order, "Wt": Wt, "T": T, "material": part.material, "double": False}
    write_glb(path, joints, list(prims.values()), extras)
    print(f"  {os.path.basename(path)}: {total} tris, {os.path.getsize(path) // 1024} KB, parts:", ", ".join(report))


# ----------------------------------------------------------------- shared recipes
def face_landmarks(h):
    L = {}
    L["eyeL"] = h.head["eye.L"]; L["eyeR"] = h.head["eye.R"]
    L["eye_y"] = L["eyeL"][1]; L["ex"] = abs(L["eyeL"][0]); L["eye_z"] = L["eyeL"][2]
    L["eye_r"] = float(np.linalg.norm(h.Vall[14598:14670] - h.Vall[14598:14670].mean(0), axis=1).max()) * 0.9
    L["lip_up"] = h.head["oris05"]; L["lip_lo"] = h.head["oris01"]
    L["corner"] = h.head["oris07.L"]
    headw = h.rw_list(FACE_BONES)
    ax = np.abs(h.V[:, 0])
    ear = (headw > 0.5) & (ax > 0.9 * ax[headw > 0.5].max())
    L["cz"] = float(h.V[ear, 2].mean())   # vertical axis of the skull passes through the ears
    L["ear_top"] = float(h.V[ear, 1].max() - L["eye_y"])
    L["u"] = L["ex"] / 0.031              # head-size unit (1.0 for the neutral head)
    return L


def face_colours(h, L, lips=(1.0, 0.66, 0.62), lip_strength=0.8):
    """Multiplicative vertex colours for the skin: lips, mouth interior, eye sockets, blush."""
    V = h.V; u = L["u"]
    C = np.ones((NB, 3))
    my = (L["lip_up"][1] + L["lip_lo"][1]) / 2
    hw = abs(L["corner"][0]) * 1.02; hh = abs(L["lip_up"][1] - L["lip_lo"][1]) / 2 + 0.0065 * u
    lz = max(L["lip_up"][2], L["lip_lo"][2])
    e = (V[:, 0] / hw) ** 2 + ((V[:, 1] - my) / hh) ** 2
    front = V[:, 2] > lz - 0.014 * u
    lip = (1 - smoothstep(0.55, 1.0, e)) * front * lip_strength
    C = C * (1 - lip[:, None]) + np.array(lips) * lip[:, None]
    inside = (e < 1.6) & (V[:, 2] < lz - 0.014 * u) & (V[:, 2] > lz - 0.07) & (np.abs(V[:, 1] - my) < 0.03)
    C[inside] = (0.25, 0.07, 0.07)
    for E in (L["eyeL"], L["eyeR"]):
        d = np.linalg.norm(V - (E + np.array([0, 0, 0.012])), axis=1)
        sh = 1 - 0.22 * (1 - smoothstep(0.012 * u, 0.03 * u, d))
        C *= sh[:, None]
        cheek = E + np.array([np.sign(E[0]) * 0.012, -0.038, 0.0]) * u
        d = np.linalg.norm(V - cheek, axis=1)
        bl = (1 - smoothstep(0.0, 0.03 * u, d)) * 0.10
        C *= 1 + bl[:, None] * np.array([0.6, -0.5, -0.5])
    under = smoothstep(L["lip_lo"][1] - 0.035, L["lip_lo"][1] - 0.075, V[:, 1]) * (V[:, 2] > L["cz"] - 0.01) * (h.rw_list(FACE_BONES) + h.rw("neck") > 0.5)
    C *= (1 - 0.14 * under)[:, None]
    return np.clip(C, 0, 1.3)


def hairline(L, front=0.058, lower=0.0):
    """height (above eye level) where hair starts, as a function of azimuth from the front (degrees)"""
    u = L["u"]
    et = L["ear_top"] / u
    tab = np.array([[0, front], [30, front + 0.003], [50, 0.05], [64, 0.022], [76, et + 0.004], [90, et + 0.007], [102, et - 0.004], [116, -0.03], [140, -0.05], [180, -0.066]])

    def f(az):
        return np.interp(np.abs(az), tab[:, 0], tab[:, 1]) * u + lower
    return f


def make_hair(h, L, style, tint_noise=0.18):
    V = h.V; u = L["u"]
    headw = h.rw_list(FACE_BONES) + h.rw("neck")
    az = np.degrees(np.arctan2(V[:, 0], V[:, 2] - L["cz"]))
    rel = V[:, 1] - L["eye_y"]
    front = {"short": 0.058, "buzz": 0.06, "messy": 0.044, "bob": 0.05, "long": 0.052, "ponytail": 0.058, "curly": 0.052}[style]
    hl = hairline(L, front)(az)
    core = (rel > hl) & (headw > 0.5)
    # the scalp mesh is coarse: grow the selection by one ring, then pull that ring onto the hairline
    nbs = h.neighbors()
    ax = np.abs(V[:, 0])
    ear = (ax > 0.87 * ax[h.rw_list(FACE_BONES) > 0.5].max()) & (rel < L["ear_top"] + 0.004)
    ring = np.zeros(NB, bool)
    for i in np.where(core)[0]:
        for j in nbs[i]:
            ring[j] = True
    mask = core | (ring & (headw > 0.5) & ~ear & (rel > hl - 0.04 * u))
    noise = rng.random(NB)
    top = smoothstep(0.03, 0.11, rel)
    if style == "buzz":
        off = 0.004 + 0.002 * noise
    elif style == "short":
        off = 0.009 + 0.008 * top + 0.004 * noise
    elif style == "messy":
        off = 0.014 + 0.016 * top + 0.012 * noise + 0.012 * smoothstep(40, 0, np.abs(az)) * top
    elif style == "curly":
        off = 0.022 + 0.022 * top + 0.016 * noise
    else:
        off = 0.012 + 0.008 * top + 0.003 * noise
    smooth = {"messy": 2, "curly": 1, "buzz": 2}.get(style, 3)

    def colour(Vs, idx):
        streak = 0.8 + tint_noise * np.sin(az[idx] * 0.9 + rel[idx] * 160) * 0.5 + tint_noise * (noise[idx] - 0.5)
        return np.clip(streak, 0.5, 1.1)[:, None] * np.ones(3)
    jag = 0.012 if style == "messy" else (0.006 if style == "curly" else 0.002)

    def to_hairline(Vs, idx):
        # pull the rim of the cap onto the hairline curve so it is not a staircase of quads
        Vs = Vs.copy()
        rim = ~core[idx]
        want = L["eye_y"] + hl[idx] - 0.003 * u + (noise[idx] - 0.5) * jag * u
        Vs[rim, 1] = np.clip(want[rim], Vs[rim, 1] - 0.005 * u, Vs[rim, 1] + 0.04 * u)
        return Vs
    parts = [shell(h, "hair", mask, off * u, smooth, 0.003, color=colour, shape=to_hairline, hem_smooth=0 if style == "messy" else 3)[0]]
    hb = BI["head"]

    def sheet(rows, wfun):
        Vs, Cs, Ws = [], [], []
        for (y, angs, rad, zc, xs) in rows:
            for a in angs:
                ar = np.radians(a)
                Vs.append([np.sin(ar) * rad * xs, y, zc - np.cos(ar) * rad])
                Cs.append(np.ones(3) * (0.78 + 0.2 * np.sin(a * 0.35 + y * 60)))
                Ws.append(wfun(y))
        return np.array(Vs), np.array(Cs), np.array(Ws, np.float32)
    if style in ("bob", "long"):
        # curtain of hair around the back of the head, from ear to ear
        y0 = L["eye_y"] + 0.045 * u
        y1 = L["eye_y"] - (0.115 if style == "bob" else 0.26) * u
        nrow = 6 if style == "bob" else 9
        angs = np.linspace(-118, 118, 17)
        chest, neck = BI["spine01"], BI["neck01"]
        rows = []
        for r in range(nrow):
            t = r / (nrow - 1)
            y = y0 + (y1 - y0) * t
            rad = (0.094 + 0.012 * np.sin(np.pi * min(1, t * 1.4)) - (0.022 * t * t if style == "bob" else 0.004 * t)) * u
            rows.append((y, angs, rad, L["cz"] - 0.004 - (0.0 if style == "bob" else 0.018 * t), 0.86))

        def wfun(y):
            w = np.zeros(len(BONES), np.float32)
            k = float(smoothstep(L["eye_y"] - 0.10 * u, L["eye_y"] - 0.24 * u, y)) if style == "long" else 0.0
            w[hb] = 1 - k * 0.75; w[neck] = k * 0.35; w[chest] = k * 0.40
            return w
        Vs, Cs, Ws = sheet(rows, wfun)
        parts.append(Part("hair", Vs, grid_tris(nrow, len(angs)), Ws, Cs, double=True))
    if style == "ponytail":
        # tail: a tapered tube from the back of the head curving down
        base = np.array([0, L["eye_y"] + 0.055 * u, L["cz"] - 0.092 * u])
        seg, rings = 8, 8
        Vs, Cs = [], []
        for r in range(rings):
            t = r / (rings - 1)
            c = base + np.array([0, -0.20 * t * t - 0.02 * t, -0.055 * np.sin(np.pi * min(1, t * 1.2)) - 0.01]) * u
            rad = (0.024 * (1 - t) ** 0.6 + 0.004) * u * (0.6 if r == 0 else 1)
            for s in range(seg):
                a = 2 * np.pi * s / seg
                Vs.append(c + np.array([np.cos(a) * rad, np.sin(a) * rad * 0.5, np.sin(a) * rad]))
                Cs.append(np.ones(3) * (0.75 + 0.2 * np.sin(s * 2.1)))
        T = []
        for r in range(rings - 1):
            for s in range(seg):
                a = r * seg + s; b = r * seg + (s + 1) % seg
                T += [[a, a + seg, b + seg], [a, b + seg, b]]
        parts.append(rigid("hair", Vs, np.array(T), "head", Cs, double=True))
    return parts


def make_brows(h, L, skinV, skinW, thickness=1.0):
    u = L["u"]; n = 7
    P, C = [], []
    for side in (1, -1):
        for i in range(n):
            s = i / (n - 1)
            x = side * (0.011 + 0.045 * s) * u
            yc = L["eye_y"] + (0.0235 + 0.0045 * np.sin(np.pi * s * 0.85) - 0.0055 * s * s) * u
            th = 0.0046 * thickness * (0.75 + 0.5 * np.sin(np.pi * min(1, s * 1.6))) * (1 - 0.55 * s) * u
            P += [(x, yc + th / 2), (x, yc - th / 2)]
            C += [(1, 1, 1), (1, 1, 1)]
    T = []
    for side in range(2):
        o = side * n * 2
        for i in range(n - 1):
            a = o + i * 2
            T += [[a, a + 1, a + 3], [a, a + 3, a + 2]]
    fm = (skinV[:, 2] > L["eye_z"] - 0.02) & (np.abs(skinV[:, 1] - L["eye_y"] - 0.025 * u) < 0.03 * u)
    return draped(h, "brows", P, np.array(T), 0.0016, np.array(C), (skinV[fm], skinW[fm]))


def regions(h):
    r = {}
    r["torso"] = h.rw("root", "spine", "breast", "pelvis", "clavicle", "shoulder")
    r["neck"] = h.rw("neck"); r["face"] = h.rw_list(FACE_BONES)
    r["uarm"] = h.rw("upperarm"); r["farm"] = h.rw("lowerarm")
    r["hand"] = h.rw("wrist", "metacarpal", "finger")
    r["thigh"] = h.rw("upperleg"); r["shin"] = h.rw("lowerleg"); r["foot"] = h.rw("foot", "toe")
    V = h.V
    tU = np.where(V[:, 0] > 0, h.t_along(h.head["upperarm01.L"], h.head["lowerarm01.L"]), h.t_along(h.head["upperarm01.R"], h.head["lowerarm01.R"]))
    tF = np.where(V[:, 0] > 0, h.t_along(h.head["lowerarm01.L"], h.head["wrist.L"]), h.t_along(h.head["lowerarm01.R"], h.head["wrist.R"]))
    tS = np.where(V[:, 0] > 0, h.t_along(h.head["lowerleg01.L"], h.head["foot.L"]), h.t_along(h.head["lowerleg01.R"], h.head["foot.R"]))
    r["tU"], r["tF"], r["tS"] = tU, tF, tS
    r["hip_y"] = h.head["upperleg01.L"][1]
    r["waist_y"] = h.head["spine03"][1]
    return r


# ----------------------------------------------------------------- students
STUDENT_JOINTS = [
    ("root", None, "root", ["*"]),
    ("spine", "root", "spine03", ["spine03", "spine02", "spine01", "breast*", "clavicle*", "shoulder*", "upperarm*", "lowerarm*", "wrist*", "metacarpal*", "finger*"]),
    ("neck", "spine", "neck01", ["neck*"]),
    ("head", "neck", "head", FACE_BONES),
    ("jaw", "head", "jaw", [b for b in descendants("jaw") if not b.startswith("tongue")]),
    ("eyeL", "head", "eye.L", ["eye.L"]), ("eyeR", "head", "eye.R", ["eye.R"]),
    ("lidL", "head", "orbicularis03.L", ["orbicularis03.L"]), ("lidR", "head", "orbicularis03.R", ["orbicularis03.R"]),
]

STUDENTS = {
    # g: gender, eth: ethnicity mix, age: 0 child .. 1 adult, detail: polygon budget (1 = friend, sits next to you)
    "sam":    dict(g="male", eth={"african": 0.45, "caucasian": 0.55}, age=0.56, hair="messy", sleeves="long", pose="desk", detail=1.0, lip=0.45,
                   skin=(0.60, 0.42, 0.29), top=(0.46, 0.11, 0.10), pants=(0.13, 0.15, 0.24), hairc=(0.10, 0.065, 0.04), shoes=(0.75, 0.75, 0.72), iris=(0.30, 0.18, 0.08)),
    "nora":   dict(g="female", eth={"asian": 0.55, "caucasian": 0.45}, age=0.56, hair="ponytail", sleeves="long", pose="desk", detail=1.0, lip=0.85,
                   skin=(0.80, 0.60, 0.46), top=(0.10, 0.30, 0.32), pants=(0.10, 0.10, 0.13), hairc=(0.05, 0.04, 0.035), shoes=(0.55, 0.2, 0.25), iris=(0.22, 0.13, 0.06)),
    "kid_a":  dict(g="male", eth={"caucasian": 1.0}, age=0.52, hair="short", sleeves="short", pose="desk", detail=0.3, lip=0.4,
                   skin=(0.82, 0.62, 0.50), top=(0.20, 0.30, 0.48), pants=(0.16, 0.15, 0.14), hairc=(0.42, 0.30, 0.16), shoes=(0.2, 0.2, 0.22), iris=(0.25, 0.4, 0.55)),
    "kid_b":  dict(g="male", eth={"african": 0.9, "asian": 0.1}, age=0.62, hair="curly", sleeves="long", pose="slump", detail=0.3, lip=0.35,
                   skin=(0.36, 0.24, 0.16), top=(0.55, 0.50, 0.18), pants=(0.12, 0.13, 0.18), hairc=(0.03, 0.025, 0.02), shoes=(0.7, 0.7, 0.7), iris=(0.2, 0.11, 0.05)),
    "kid_c":  dict(g="female", eth={"caucasian": 0.8, "asian": 0.2}, age=0.52, hair="bob", sleeves="short", pose="desk", detail=0.3, lip=0.85,
                   skin=(0.84, 0.66, 0.55), top=(0.55, 0.30, 0.42), pants=(0.14, 0.16, 0.26), hairc=(0.30, 0.13, 0.06), shoes=(0.8, 0.8, 0.8), iris=(0.3, 0.42, 0.3)),
    "kid_d":  dict(g="female", eth={"african": 0.5, "asian": 0.5}, age=0.6, hair="long", sleeves="long", pose="slump", detail=0.3, lip=0.8,
                   skin=(0.52, 0.36, 0.25), top=(0.62, 0.60, 0.56), pants=(0.08, 0.08, 0.10), hairc=(0.04, 0.03, 0.03), shoes=(0.15, 0.15, 0.15), iris=(0.22, 0.12, 0.06)),
    "kid_e":  dict(g="male", eth={"asian": 0.8, "caucasian": 0.2}, age=0.5, hair="messy", sleeves="short", pose="slump", detail=0.3, lip=0.4,
                   skin=(0.78, 0.60, 0.44), top=(0.16, 0.36, 0.22), pants=(0.20, 0.19, 0.17), hairc=(0.04, 0.035, 0.03), shoes=(0.3, 0.3, 0.6), iris=(0.2, 0.12, 0.06)),
    "kid_f":  dict(g="female", eth={"caucasian": 0.5, "african": 0.5}, age=0.58, hair="ponytail", sleeves="long", pose="desk", detail=0.3, lip=0.8,
                   skin=(0.66, 0.47, 0.34), top=(0.34, 0.16, 0.40), pants=(0.12, 0.12, 0.14), hairc=(0.09, 0.05, 0.03), shoes=(0.8, 0.8, 0.8), iris=(0.26, 0.16, 0.08)),
}


def student_targets(spec):
    t = {}
    for eth, w in spec["eth"].items():
        t[f"{eth}-{spec['g']}-young"] = w * spec["age"]
        t[f"{eth}-{spec['g']}-child"] = w * (1 - spec["age"])
    return t


def seated_pose(h, kind="desk"):
    """Sitting on a chair (seat at y = 0 after export shift) with forearms on the desk in front."""
    p = Pose(h)
    lean = 0.20 if kind == "desk" else 0.42
    p.R["spine05"] = rot_axis([1, 0, 0], lean * 0.5)
    p.R["spine03"] = rot_axis([1, 0, 0], lean * 0.3)
    p.R["spine01"] = rot_axis([1, 0, 0], lean * 0.2)
    p.R["neck01"] = rot_axis([1, 0, 0], -lean * 0.45 if kind == "desk" else 0.1)
    p.R["head"] = rot_axis([1, 0, 0], -lean * 0.35 if kind == "desk" else 0.25)
    for s, sx in ((".L", 1), (".R", -1)):
        p.aim("upperleg01" + s, [0.10 * sx, -0.20, 1.0], tail=h.head["lowerleg01" + s])
        p.aim("lowerleg01" + s, [0.0, -1.0, 0.06], tail=h.head["foot" + s])
        p.aim("foot" + s, norm(h.tail["foot" + s] - h.head["foot" + s]) * [0, 1, 1] + [0.05 * sx, 0, 0])
    p.solve()
    hip = (p.pos("upperleg01.L") + p.pos("upperleg01.R")) / 2
    seat_y = hip[1] - 0.085
    for s, sx in ((".L", 1), (".R", -1)):
        if kind == "desk":
            wrist = [0.085 * sx, seat_y + 0.27 + 0.028, hip[2] + 0.43]
            pole = [0.75 * sx, seat_y - 0.2, hip[2] + 0.0]
        else:  # slumped: arms folded further in, elbows wide
            wrist = [-0.03 * sx, seat_y + 0.27 + 0.03, hip[2] + 0.40 + 0.03 * sx]
            pole = [0.9 * sx, seat_y + 0.1, hip[2] + 0.1]
        p.ik("upperarm01" + s, "lowerarm01" + s, h.head["wrist" + s], wrist, pole)
        # palm down, fingers forward
        fing = h.head["finger3-1" + s]
        p.aim("wrist" + s, [-0.25 * sx, -0.12, 1.0], tail=fing)
        palm0 = -norm(np.cross(h.head["finger2-1" + s] - h.head["wrist" + s], h.head["finger5-1" + s] - h.head["wrist" + s])) * sx
        p.twist_to("wrist" + s, palm0, [0, -1, 0], tail=fing)
    p.solve()
    return p, np.array([hip[0], seat_y, hip[2]])


def build_student(name, spec):
    print(name)
    h = Human(student_targets(spec))
    L = face_landmarks(h); r = regions(h)
    V = h.V
    core = r["torso"] + r["uarm"] + r["farm"]
    arm = (r["uarm"] + r["farm"] + r["hand"]) > 0.5
    if spec["sleeves"] == "long":
        sleeve_ok = ~((r["farm"] + r["hand"] > 0.5) & (r["tF"] > 0.9))
    else:
        sleeve_ok = ~(arm & ((r["tU"] > 0.62) | (r["farm"] + r["hand"] > 0.5)))
    top = (core > 0.5) & sleeve_ok & (r["neck"] + r["face"] < 0.35) & ~((r["torso"] > 0.5) & (V[:, 1] < r["hip_y"] - 0.03))
    top &= ~(r["hand"] > 0.5)
    pants = (((r["thigh"] + r["shin"]) > 0.5) & (r["tS"] < 0.9)) | ((r["torso"] + r["thigh"] > 0.5) & (V[:, 1] < r["waist_y"]) & (r["uarm"] + r["farm"] + r["hand"] < 0.3))
    feet = (r["foot"] > 0.5) | ((r["shin"] + r["foot"] > 0.5) & (r["tS"] >= 0.86))
    loose = 0.021 if spec["g"] == "male" else 0.016

    def top_col(Vs, idx):
        c = np.ones((len(idx), 3))
        if spec["sleeves"] == "short":  # two-tone stripes
            band = (np.floor(h.V[idx, 1] / 0.035) % 2) * 0.25
            c *= (1 - band)[:, None]
        cuff = ((r["tF"][idx] > 0.8) & (r["farm"][idx] > 0.5)) | (h.V[idx, 1] < r["hip_y"] + 0.0)
        c[cuff] *= 0.78
        return c
    p_top, _ = shell(h, "top", top, loose + 0.006 * smoothstep(0.3, 0.8, r["torso"]), 8, 0.008, color=top_col)
    p_pants, _ = shell(h, "pants", pants, 0.012, 5, 0.006)
    hidden = h.erode(top | pants | feet, 2)
    C = face_colours(h, L, lip_strength=spec["lip"])
    skin, _ = body_part(h, "skin", ~hidden, C, None)
    parts = [skin, p_top, p_pants]
    parts += make_hair(h, L, spec["hair"])
    parts.append(make_brows(h, L, skin.V, skin.W, 1.15 if spec["g"] == "male" else 0.8))
    parts += [make_eye(L[k], L["eye_r"], spec["iris"], b) for k, b in (("eyeL", "eye.L"), ("eyeR", "eye.R"))]
    scale = 1.0 if spec["g"] == "male" else 0.96
    for s_ in (".L", ".R"):
        parts.append(make_shoe(h.head["foot" + s_], scale, "foot" + s_))
    pose, origin = seated_pose(h, spec["pose"])
    d = spec["detail"]
    simplify = {"skin": 4600 if d >= 1 else 1500, "top": int(1500 * d) + 200, "pants": int(800 * d) + 150, "hair": 900 if d >= 1 else 320, "shoes": None if d >= 1 else 60}
    hc = np.array(spec["hairc"])
    bake = {"skin": ("body", spec["skin"]), "top": ("body", spec["top"]), "pants": ("body", spec["pants"]), "hair": ("body", spec["hairc"]),
            "brows": ("body", tuple(hc * 0.7)), "shoes": ("body", spec["shoes"]), "eyes": ("eyes", (1, 1, 1))}
    extras = {"eyeRadius": L["eye_r"], "kind": "student", "pose": spec["pose"], "gender": spec["g"]}
    export(os.path.join(OUT, name + ".glb"), pose, parts, STUDENT_JOINTS, simplify, extras, transform=lambda P: P - origin, bake=bake)


# ----------------------------------------------------------------- Madi's body
MADI_JOINTS = [
    ("root", None, "root", ["*"]),
    ("spine", "root", "spine04", ["spine04", "spine03"]),
    ("chest", "spine", "spine02", ["spine02", "spine01", "breast*", "clavicle*", "shoulder*", "neck*"] + FACE_BONES),
    ("neck", "chest", "neck01", []),
    ("uarmL", "chest", "upperarm01.L", ["upperarm01.L", "upperarm02.L"]), ("farmL", "uarmL", "lowerarm01.L", ["lowerarm01.L", "lowerarm02.L"]),
    ("handL", "farmL", "wrist.L", ["wrist.L", "metacarpal1.L", "metacarpal2.L", "metacarpal3.L", "metacarpal4.L"] + [b for b in BONES if b.startswith("finger") and b.endswith(".L")]),
    ("uarmR", "chest", "upperarm01.R", ["upperarm01.R", "upperarm02.R"]), ("farmR", "uarmR", "lowerarm01.R", ["lowerarm01.R", "lowerarm02.R"]),
    ("handR", "farmR", "wrist.R", ["wrist.R", "metacarpal1.R", "metacarpal2.R", "metacarpal3.R", "metacarpal4.R"] + [b for b in BONES if b.startswith("finger") and b.endswith(".R")]),
    ("thighL", "root", "upperleg01.L", ["upperleg01.L", "upperleg02.L"]), ("shinL", "thighL", "lowerleg01.L", ["lowerleg01.L", "lowerleg02.L"]),
    ("footL", "shinL", "foot.L", ["foot.L"] + [b for b in BONES if b.startswith("toe") and b.endswith(".L")]),
    ("thighR", "root", "upperleg01.R", ["upperleg01.R", "upperleg02.R"]), ("shinR", "thighR", "lowerleg01.R", ["lowerleg01.R", "lowerleg02.R"]),
    ("footR", "shinR", "foot.R", ["foot.R"] + [b for b in BONES if b.startswith("toe") and b.endswith(".R")]),
]


def build_madi():
    print("madi")
    h = Human({f"{e}-male-young": 1 / 3 for e in ("caucasian", "african", "asian")})
    r = regions(h); V = h.V
    ARM, HAND = 1.20, 1.16
    # ---- clothes (rest pose)
    jacket = ((r["torso"] + r["uarm"] + r["farm"]) > 0.5) & ~((r["farm"] + r["hand"] > 0.5) & (r["tF"] > 0.95)) & (r["hand"] < 0.5)
    jacket &= (r["neck"] + r["face"] < 0.3) & ~((r["torso"] > 0.5) & (V[:, 1] < r["hip_y"] - 0.07))
    shoulder_pad = h.rw("clavicle", "shoulder")
    p_jacket, _ = shell(h, "suit", jacket, 0.02 + 0.014 * smoothstep(0.2, 0.7, shoulder_pad), 8, 0.012)
    trousers = (((r["thigh"] + r["shin"]) > 0.5) & (r["tS"] < 0.97)) | ((r["torso"] + r["thigh"] > 0.5) & (V[:, 1] < r["waist_y"] + 0.02) & (r["uarm"] + r["farm"] + r["hand"] < 0.3))

    def straight_leg(Vs, idx):
        Vs = Vs.copy()
        for s, sx in ((".L", 1), (".R", -1)):
            A, B = h.head["lowerleg01" + s], h.head["foot" + s]
            d = norm(B - A)
            sel = (r["shin"][idx] > 0.4) & (np.sign(h.V[idx, 0]) == sx)
            rel = Vs[sel] - A
            t = np.clip(rel @ d / np.linalg.norm(B - A), 0, 1.1)
            radial = rel - np.outer(rel @ d, d)
            rad = np.linalg.norm(radial, axis=1)
            want = np.maximum(rad, 0.074 - 0.006 * t)
            Vs[sel] += radial * ((want / np.maximum(rad, 1e-6)) - 1)[:, None]
        return Vs
    p_trousers, _ = shell(h, "suit", trousers, 0.015, 6, 0.008, shape=straight_leg)
    collar = (r["neck"] > 0.4) & (h.t_along(h.head["neck01"], h.head["head"]) < 0.62) | ((r["torso"] + r["neck"] > 0.5) & (V[:, 1] > h.head["neck01"][1] - 0.045) & (r["uarm"] < 0.2) & (r["face"] < 0.2) & (np.abs(V[:, 0]) < 0.075))
    p_collar, _ = shell(h, "shirt", collar, 0.027, 3, 0.02)
    hands = (r["hand"] > 0.5) | ((r["farm"] + r["hand"] > 0.5) & (r["tF"] > 0.86))
    skin, _ = body_part(h, "skin", hands, np.ones((NB, 3)), None)
    # shirt front, tie, lapels and buttons draped on the jacket chest
    JV, JW = p_jacket.V, p_jacket.W
    fm = (JV[:, 2] > 0.02) & (np.abs(JV[:, 0]) < 0.2)
    front = (JV[fm], JW[fm])
    y_top = h.head["neck01"][1] + 0.005; y_bot = h.head["spine02"][1] - 0.035
    rows, cols, w_top = 9, 7, 0.082
    P = []
    for i in range(rows):
        t = i / (rows - 1); y = y_bot + (y_top - y_bot) * t
        for j in range(cols):
            P.append(((j / (cols - 1) - 0.5) * 2 * w_top * t, y))
    p_shirt = draped(h, "shirt", P, grid_tris(rows, cols), 0.004, np.ones((len(P), 3)), front)
    P, C = [], []
    n = 8
    for i in range(n):
        t = i / (n - 1); y = y_top - 0.02 - (y_top - y_bot - 0.01) * t
        hw = 0.026 if i == 0 else (0.017 if i == 1 else 0.02 + 0.016 * t)
        if i == n - 1:
            hw = 0.003
        P += [(-hw, y), (hw, y)]; C += [(1, 1, 1)] * 2
    T = [[i * 2, i * 2 + 1, i * 2 + 3] for i in range(n - 1)] + [[i * 2, i * 2 + 3, i * 2 + 2] for i in range(n - 1)]
    p_tie = draped(h, "tie", P, np.array(T), 0.011, np.array(C), front)
    P, T = [], []
    n = 7
    for side in (1, -1):
        o = len(P)
        for i in range(n):
            t = i / (n - 1); y = y_bot - 0.01 + (y_top - y_bot + 0.02) * t
            x_in = side * w_top * t * 1.0
            wid = 0.012 + 0.05 * np.sin(np.pi * min(1.0, t * 1.15)) ** 0.8
            P += [(x_in, y), (x_in + side * wid, y - 0.012 * t)]
        for i in range(n - 1):
            a = o + i * 2
            T += [[a, a + 1, a + 3], [a, a + 3, a + 2]]
    p_lapel = draped(h, "lapel", P, np.array(T), 0.009, np.ones((len(P), 3)), front)
    P, T = [], []
    for k, by in enumerate((y_bot - 0.045, y_bot - 0.12)):
        o = len(P); P.append((0.006, by))
        for s in range(8):
            a = 2 * np.pi * s / 8
            P.append((0.006 + np.cos(a) * 0.009, by + np.sin(a) * 0.009))
        T += [[o, o + 1 + s, o + 1 + (s + 1) % 8] for s in range(8)]
    p_buttons = draped(h, "buttons", P, np.array(T), 0.006, np.ones((len(P), 3)), front)
    parts = [p_jacket, p_trousers, p_collar, p_shirt, p_tie, p_lapel, p_buttons, skin]
    for s in (".L", ".R"):
        parts.append(make_shoe(h.head["foot" + s], 1.18, "foot" + s))
    merged = {}
    for p in parts:
        if p.name in merged:
            m = merged[p.name]
            m.T = np.concatenate([m.T, p.T + len(m.V)]); m.V = np.concatenate([m.V, p.V])
            m.W = np.concatenate([m.W, p.W]); m.C = np.concatenate([m.C, p.C]); m.double |= p.double
        else:
            merged[p.name] = p
    # ---- bind pose: legs straight under the hips, long arms, big hands
    pose = Pose(h)
    for s, sx in ((".L", 1), (".R", -1)):
        pose.aim("upperleg01" + s, [0.012 * sx, -1, 0.0], tail=h.head["lowerleg01" + s])
        pose.aim("lowerleg01" + s, [0, -1, 0.0], tail=h.head["foot" + s])
        pose.aim("foot" + s, norm((h.tail["foot" + s] - h.head["foot" + s]) * [0, 1, 1]))
        du = norm(h.head["lowerarm01" + s] - h.head["upperarm01" + s]); df = norm(h.head["wrist" + s] - h.head["lowerarm01" + s])
        for b in ("upperarm01", "upperarm02"):
            pose.S[b + s] = np.eye(3) + (ARM - 1) * np.outer(du, du)
        for b in ("lowerarm01", "lowerarm02"):
            pose.S[b + s] = np.eye(3) + (ARM - 1) * np.outer(df, df)
        dh = norm(h.head["finger3-1" + s] - h.head["wrist" + s])
        pose.S["wrist" + s] = HAND * np.eye(3) + 0.22 * np.outer(dh, dh)
        for b in BONES:
            if b.endswith(s) and b.startswith(("metacarpal", "finger")):
                pose.inherit.add(b)
    pose.solve()
    SCALE = np.array([1.17, 1.135, 1.10])
    simplify = {"suit": 3800, "skin": 1700, "shirt": 500}
    tf = lambda P: P * SCALE  # noqa: E731
    extras = {"kind": "madi", "headBase": [float(x) for x in tf(pose.pos("head")[None, :])[0]]}
    # reference points for the runtime IK
    for s, key in ((".L", "L"), (".R", "R")):
        extras["wrist" + key] = [float(x) for x in tf(pose.pos("wrist" + s)[None, :])[0]]
        extras["mid" + key] = [float(x) for x in tf(pose.point("finger3-1" + s, h.head["finger3-1" + s])[None, :])[0]]
        extras["tip" + key] = [float(x) for x in tf(pose.point("finger3-3" + s, h.tail["finger3-3" + s])[None, :])[0]]
        extras["ankle" + key] = [float(x) for x in tf(pose.pos("foot" + s)[None, :])[0]]
    bake = {"suit": ("body", (0.105, 0.11, 0.14)), "lapel": ("body", (0.135, 0.14, 0.175)), "buttons": ("body", (0.03, 0.03, 0.03)),
            "shirt": ("body", (0.80, 0.82, 0.84)), "tie": ("body", (0.26, 0.05, 0.05)), "skin": ("body", (0.47, 0.32, 0.20)), "shoes": ("body", (0.035, 0.03, 0.03))}
    export(os.path.join(OUT, "madi.glb"), pose, list(merged.values()), MADI_JOINTS, simplify, extras, transform=tf, bake=bake)


def build_hand():
    """The player's own right forearm + hand (raised when asking a question)."""
    print("hand")
    h = Human({"caucasian-male-young": 0.5, "caucasian-male-child": 0.2, "african-male-young": 0.3})
    r = regions(h)
    sleeve = (r["farm"] > 0.4) & (r["tF"] < 0.9) & (h.V[:, 0] < 0) & (r["tF"] > 0.02)
    hand = ((r["hand"] > 0.5) | ((r["farm"] + r["hand"] > 0.5) & (r["tF"] > 0.84))) & (h.V[:, 0] < 0)
    p_sleeve, _ = shell(h, "top", sleeve, 0.012, 4, 0.007)
    skin, _ = body_part(h, "skin", hand, np.ones((NB, 3)), None)
    pose = Pose(h)
    pose.aim("lowerarm01.R", [0, 1, 0], tail=h.head["wrist.R"])
    pose.aim("wrist.R", [0, 1, 0], tail=h.head["finger3-1.R"])
    palm0 = -norm(np.cross(h.head["finger2-1.R"] - h.head["wrist.R"], h.head["finger5-1.R"] - h.head["wrist.R"]))
    pose.twist_to("wrist.R", palm0, [0, 0, -1], tail=h.head["finger3-1.R"])
    pose.R["lowerarm01.R"] = pose.R["lowerarm01.R"]
    pose.solve()
    origin = pose.pos("lowerarm01.R").copy()
    spec = [("root", None, "lowerarm01.R", ["*"])]
    bake = {"skin": ("body", (0.66, 0.48, 0.36)), "top": ("body", (0.16, 0.18, 0.22))}
    export(os.path.join(OUT, "hand.glb"), pose, [skin, p_sleeve], spec, {"skin": 900, "top": 260}, {"kind": "hand"}, transform=lambda P: P - origin, bake=bake)


def write_bundle():
    """All models in one JSON (base64) so hosts that do not serve .glb still work, in one request."""
    import base64
    names = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".glb"))
    bundle = {n: base64.b64encode(open(os.path.join(OUT, n + ".glb"), "rb").read()).decode() for n in names}
    with open(os.path.join(OUT, "models.json"), "w") as f:
        json.dump(bundle, f, separators=(",", ":"))
    print("  models.json:", len(names), "models,", os.path.getsize(os.path.join(OUT, "models.json")) // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:]
    for name, spec in STUDENTS.items():
        if not want or name in want:
            build_student(name, spec)
    if not want or "madi" in want:
        build_madi()
    if not want or "hand" in want:
        build_hand()
    write_bundle()
