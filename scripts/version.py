"""Set or verify the shared, single-digit x.y.z application version."""

import argparse
import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def metadata(version):
    if not re.fullmatch(r"[0-9]\.[0-9]\.[0-9]", version):
        raise ValueError("Use three single digits, for example 0.1.2")
    return {"version": version, "code": int(version.replace(".", ""))}


def set_version(version):
    value = metadata(version)
    (ROOT / "version.json").write_text(json.dumps(value, indent=2) + "\n")
    for name, count in [
        ("frontend/package.json", 1),
        ("frontend/package-lock.json", 2),
    ]:
        path = ROOT / name
        text = re.sub(
            r'("version": ")[^"]+("\s*[,}])',
            rf"\g<1>{version}\2",
            path.read_text(),
            count=count,
        )
        path.write_text(text, newline="\n")
    path = ROOT / "backend/pyproject.toml"
    path.write_text(
        re.sub(
            r'(?m)^version = "[^"]+"',
            f'version = "{version}"',
            path.read_text(),
            count=1,
        ),
        newline="\n",
    )
    path = ROOT / "backend/uv.lock"
    path.write_text(
        re.sub(
            r'(name = "arcade-nexus-backend"\nversion = ")[^"]+',
            rf"\g<1>{version}",
            path.read_text(),
        ),
        newline="\n",
    )
    for name in ["DEVELOPMENT.md", "CHANGELOG.md", "TASKS.md"]:
        path = ROOT / name
        if path.exists():
            text = re.sub(
                r"(\*\*Version:\*\* )[^\s|]+",
                rf"\g<1>{version}",
                path.read_text(encoding="utf-8"),
                count=1,
            )
            path.write_text(text, encoding="utf-8", newline="\n")


def check_version():
    value = json.loads((ROOT / "version.json").read_text())
    expected = metadata(value["version"])
    if value != expected:
        raise ValueError("version.json code must equal the version with dots removed")
    package = json.loads((ROOT / "frontend/package.json").read_text())
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text())
    backend = tomllib.loads((ROOT / "backend/pyproject.toml").read_text())
    uv = tomllib.loads((ROOT / "backend/uv.lock").read_text())
    versions = [
        package["version"],
        lock["version"],
        lock["packages"][""]["version"],
        backend["project"]["version"],
    ]
    versions += [
        p["version"] for p in uv["package"] if p["name"] == "arcade-nexus-backend"
    ]
    if len(versions) != 5 or any(v != expected["version"] for v in versions):
        raise ValueError(f"Project versions differ: {versions}")
    for name in ["DEVELOPMENT.md", "CHANGELOG.md", "TASKS.md"]:
        path = ROOT / name
        if path.exists():
            header = re.search(
                r"\*\*Version:\*\* ([^\s|]+)", path.read_text(encoding="utf-8")
            )
            if header and header[1] != expected["version"]:
                raise ValueError(f"{name} version header differs from version.json")
    print(f"Version metadata aligned: {expected['version']} ({expected['code']})")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--set", metavar="X.Y.Z", help="Update application manifests and lock metadata"
    )
    parser.add_argument(
        "--check", action="store_true", help="Verify all application versions"
    )
    args = parser.parse_args()
    if args.set:
        set_version(args.set)
    check_version()


if __name__ == "__main__":
    main()
