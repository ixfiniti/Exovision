import json
import os
import traceback
from typing import Any, Dict, List, Optional

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates",
)

DATA_PATH = os.path.join(app.root_path, "planets.json")


def to_float_safe(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip()
        if s == "":
            return None
        s = s.replace(",", "")
        if s.endswith("%"):
            s = s[:-1].strip()
        if s == "":
            return None
        return float(s)
    except Exception:
        return None


def compute_norm_fields(p: Dict[str, Any]) -> Dict[str, Any]:
    c = dict(p)

    raw_hp = p.get("habitability_percent")
    if raw_hp is not None:
        hnum = to_float_safe(raw_hp)
        c["habitability_percent_norm"] = hnum
        c["habitability_percent_raw"] = str(raw_hp)
    else:
        c["habitability_percent_norm"] = None
        c["habitability_percent_raw"] = None

    comp = p.get("composite_habitability")
    comp_num = to_float_safe(comp)
    c["composite_habitability_norm"] = comp_num

    t = None
    if p.get("avg_temp_C") is not None:
        t = to_float_safe(p.get("avg_temp_C"))
    elif p.get("eq_temp_K") is not None:
        kk = to_float_safe(p.get("eq_temp_K"))
        if kk is not None:
            t = kk - 273.15
    c["avg_temp_C_norm"] = t

    return c


if not os.path.exists(DATA_PATH):
    sample = [{
        "name": "Earth",
        "radius": 1.0,
        "mass": 1.0,
        "surface_gravity": 1.0,
        "avg_temp_C": 14.85,
        "orbital_period_days": 365.25,
        "habitability_percent": "99.77800",
        "composite_habitability": "0.99778",
        "is_rocky": True,
        "is_gas_giant": False,
        "narrative_flags": {},
    }]
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(sample, f, indent=2)

try:
    with open(DATA_PATH, "r", encoding="utf-8") as fh:
        PLANETS: List[Dict[str, Any]] = json.load(fh)
except Exception:
    PLANETS = []


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/explorer")
def explorer():
    return render_template("explorer.html")


@app.route("/leaderboards")
def leaderboards_page():
    return render_template("leaderboards.html")


@app.route("/compare")
def compare_page():
    return render_template("compare.html")


@app.route("/about")
def about_page():
    return render_template("about.html")


@app.route("/contact")
def contact_page():
    return render_template("contact.html")


@app.route("/homage")
def homage_page():
    return render_template("homage.html")


@app.route("/planet")
def planet_page():
    name = request.args.get("name", "").strip()
    if not name:
        return redirect(url_for("explorer"))
    for p in PLANETS:
        if p.get("name") and p["name"].lower() == name.lower():
            return render_template("planet.html",
                                   planet=compute_norm_fields(p))
    for p in PLANETS:
        if p.get("name") and name.lower() in p["name"].lower():
            return render_template("planet.html",
                                   planet=compute_norm_fields(p))
    return render_template("planet_not_found.html", name=name), 404


@app.route("/api/all")
def api_all():
    try:
        return jsonify([compute_norm_fields(p) for p in PLANETS])
    except Exception:
        traceback.print_exc()
        return jsonify([]), 500


@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").lower().strip()
    limit = int(request.args.get("limit", 10))
    if not q:
        return jsonify([])
    matches: List[Dict[str, Any]] = []
    for p in PLANETS:
        name = p.get("name")
        if name and q in name.lower():
            matches.append(compute_norm_fields(p))
    starts = [m for m in matches if m["name"].lower().startswith(q)]
    contains = [m for m in matches if not m["name"].lower().startswith(q)]
    ordered = starts + contains
    return jsonify(ordered[:limit])


@app.route("/api/top")
def api_top():
    try:
        cat = request.args.get("cat", "most_habitable")
        limit = int(request.args.get("limit", 5))
        if cat == "most_habitable":
            arr = []
            for p in PLANETS:
                pnorm = compute_norm_fields(p)
                hn = pnorm.get("habitability_percent_norm")
                if hn is not None and pnorm.get("name", "").lower() != "earth":
                    arr.append((hn, pnorm))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat in ("most_hot", "most_temperature"):
            arr = []
            for p in PLANETS:
                pnorm = compute_norm_fields(p)
                tv = pnorm.get("avg_temp_C_norm")
                if tv is not None:
                    arr.append((tv, pnorm))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "most_mass":
            arr = []
            for p in PLANETS:
                m = to_float_safe(
                    p.get("mass") or p.get("pl_bmasse") or p.get("bmasse"))
                if m is not None:
                    arr.append((m, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "largest_radius":
            arr = []
            for p in PLANETS:
                r = to_float_safe(
                    p.get("radius") or p.get("pl_rade") or p.get("pl_rade"))
                if r is not None:
                    arr.append((r, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "coldest":
            arr = []
            for p in PLANETS:
                pnorm = compute_norm_fields(p)
                tv = pnorm.get("avg_temp_C_norm")
                if tv is not None:
                    arr.append((tv, pnorm))
            arr.sort(key=lambda x: x[0])
            planets_sorted = [p for _, p in arr]
        elif cat == "most_dense":
            arr = []
            for p in PLANETS:
                d = to_float_safe(p.get("density_rel") or p.get("density"))
                if d is not None:
                    arr.append((d, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "highest_gravity":
            arr = []
            for p in PLANETS:
                g = to_float_safe(p.get("surface_gravity"))
                if g is not None:
                    arr.append((g, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "lowest_gravity":
            arr = []
            for p in PLANETS:
                g = to_float_safe(p.get("surface_gravity"))
                if g is not None:
                    arr.append((g, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0])
            planets_sorted = [p for _, p in arr]
        elif cat == "longest_orbital_period":
            arr = []
            for p in PLANETS:
                orb = to_float_safe(p.get("orbital_period_days"))
                if orb is not None:
                    arr.append((orb, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0], reverse=True)
            planets_sorted = [p for _, p in arr]
        elif cat == "shortest_orbital_period":
            arr = []
            for p in PLANETS:
                orb = to_float_safe(p.get("orbital_period_days"))
                if orb is not None:
                    arr.append((orb, compute_norm_fields(p)))
            arr.sort(key=lambda x: x[0])
            planets_sorted = [p for _, p in arr]
        else:
            planets_sorted = [compute_norm_fields(p) for p in PLANETS]
        return jsonify(planets_sorted[:limit])
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "server error in /api/top"}), 500


@app.route("/api/random")
def api_random():
    try:
        import random
        if len(PLANETS) == 0:
            return jsonify({"error": "no planets available"}), 404
        
        eligible_planets = []
        for p in PLANETS:
            pnorm = compute_norm_fields(p)
            hab = pnorm.get("habitability_percent_norm")
            if hab is not None and hab > 1.0:
                eligible_planets.append(pnorm)
        
        if len(eligible_planets) == 0:
            planet = random.choice(PLANETS)
            return jsonify(compute_norm_fields(planet))
        
        planet = random.choice(eligible_planets)
        return jsonify(planet)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "server error"}), 500


@app.route("/api/contact", methods=["POST"])
def api_contact():
    try:
        payload = request.get_json() or {}
        print("CONTACT:", payload)
        return jsonify({"ok": True})
    except Exception:
        traceback.print_exc()
        return jsonify({"ok": False}), 500


@app.route("/planets.json")
def serve_planets_json():
    return send_from_directory(app.root_path,
                               "planets.json",
                               mimetype="application/json")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

# this code was fully debugged using AI
