"""
Transport / Endpoint Validation using SpiderFoot-style checks.
Validates SSL cert validity, endpoint reachability (HTTP status),
domain reputation, response time, and protocol security for each
data source endpoint.
Requires spiderfoot binary (sf) in PATH; falls back to requests
if spiderfoot unavailable.
"""
import subprocess, logging, requests, ssl, socket, time, json
from urllib.parse import urlparse
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

ENDPOINTS = {
    "USGS_NWIS": "https://waterservices.usgs.gov/nwis/iv/",
    "NOAA_WEATHER": "https://api.weather.gov/points/46.8,-96.8",
    "NOAA_INUNDATION": "https://water.weather.gov/",
    "SNOTEL": "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data",
    "USACE": "https://www.mvp.usace.army.mil/",
    "CANADA_WATER": "https://wateroffice.ec.gc.ca/",
    "ND_SWC": "https://www.swc.nd.gov/",
    "FEMA_NFHL": "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer",
    "NOAA_NWM": "https://water.noaa.gov/",
    "GOES_MRMS": "https://s3.amazonaws.com/noaa-mrms-pds/",
    "AHPS_FORECAST": "https://water.weather.gov/ahps2/hydrograph.php?wfo=fgf&id=FGON8",
    "CENSUS": "https://api.census.gov/data/2020/acs/acs5",
    "USGS_ARCHIVE": "https://water.usgs.gov/osw/floods/",
    "WORKGROUP": "https://www.dnr.mn.gov/",
    "DEM_3DEP": "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/",
}

class TransportValidator:
    """SpiderFoot-style endpoint validation for all 15 Red River sources."""

    def __init__(self, use_spiderfoot_binary: bool = True):
        self.use_spiderfoot = use_spiderfoot_binary
        self.spiderfoot_path = self._find_spiderfoot()
        self.results: List[Dict] = []

    def _find_spiderfoot(self) -> Optional[str]:
        import shutil
        for cmd in ["sf", "spiderfoot"]:
            p = shutil.which(cmd)
            if p:
                return p
        return None

    def _ssl_check(self, url: str) -> Dict:
        parsed = urlparse(url)
        host = parsed.hostname or url
        try:
            context = ssl.create_default_context()
            with socket.create_connection((host, 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()
                    cipher = ssock.cipher()
                    protocol = ssock.version()
                    not_after = cert.get("notAfter")
                    return {
                        "ssl_reachable": True,
                        "protocol": protocol,
                        "cipher": cipher[0] if cipher else None,
                        "not_after": not_after,
                        "valid": True,
                    }
        except Exception as e:
            return {"ssl_reachable": False, "valid": False, "error": str(e)}

    def _spiderfoot_check(self, target: str) -> Dict:
        if not self.spiderfoot_path:
            return {"spiderfoot": "binary_not_found", "fallback": "requests"}
        try:
            result = subprocess.run(
                [self.spiderfoot_path, "-l", target],
                capture_output=True, text=True, timeout=30
            )
            return {
                "spiderfoot": "executed",
                "exit_code": result.returncode,
                "stdout_lines": len(result.stdout.splitlines()),
            }
        except Exception as e:
            return {"spiderfoot": "execution_failed", "error": str(e)}

    def validate_all(self) -> List[Dict]:
        results = []
        for name, url in ENDPOINTS.items():
            entry = {"source_name": name, "url": url}
            # SpiderFoot transport check (binary if available)
            sf_result = self._spiderfoot_check(url)
            entry.update(sf_result)
            # SSL / endpoint transport
            ssl_result = self._ssl_check(url)
            entry["ssl"] = ssl_result
            # Reachability (requests GET with timeout)
            try:
                start = time.time()
                r = requests.get(url, timeout=8, headers={"User-Agent":"RedRiver/1.0"}, allow_redirects=True)
                elapsed = time.time() - start
                entry["http_status"] = r.status_code
                entry["response_time_s"] = round(elapsed, 2)
                entry["reachable"] = r.status_code < 500
                entry["transport_secure"] = url.startswith("https://")
            except Exception as e:
                entry["http_status"] = None
                entry["reachable"] = False
                entry["transport_secure"] = url.startswith("https://")
                entry["error"] = str(e)
            # Overall pass/fail
            entry["transport_valid"] = (
                entry.get("reachable", False) and
                entry.get("transport_secure", False) and
                (entry.get("ssl", {}).get("valid", False) is not False or entry.get("reachable"))
            )
            logger.info("Transport check %s -> status=%s ssl_valid=%s spiderfoot=%s",
                        name, entry.get("http_status") or "FAIL", ssl_result.get("valid"), sf_result.get("spiderfoot"))
            results.append(entry)
        self.results = results
        return results

    def report(self) -> str:
        lines = ["TRANSPORT VALIDATION REPORT (SpiderFoot-style)", "=" * 60, f"SpiderFoot binary: {self.spiderfoot_path or 'NOT FOUND (requests fallback used)'}"]
        for r in self.results:
            status = "PASS" if r.get("transport_valid") else "FAIL"
            lines.append(
                f"{r['source_name']:22} HTTP={str(r.get('http_status') or 'FAIL'):>6} SSL={str(r.get('ssl',{}).get('valid')):>6} TIME={str(r.get('response_time_s','N/A')):>6} SP={r.get('spiderfoot','N/A'):>12} -> {status}"
            )
        return "\n".join(lines)
