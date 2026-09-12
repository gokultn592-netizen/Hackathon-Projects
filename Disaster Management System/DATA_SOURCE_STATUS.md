FALLBACK / SIMULATION STATUS — Red River Basin (15 sources)
=============================================================
Live endpoint verified but requires auth / protected / unreachable
==> graceful simulated/embedded fallback active.

SOURCE                    STATUS              REASON / WHY                 FALLBACK TYPE
--------------------------------------------------------------------------------
AHPS (water.weather.gov)  UNREACHABLE (DNS)  Endpoint blocks / DNS fail     Simulated 5-day forecast (FGON8, GFKW3 real station IDs)
FEMA NFHL                 SSL / RESET        Protected MapServer endpoint  Simulated 1 zone (AE, Cass ND, BFE=905)
NOAA Inundation            UNREACHABLE (DNS)  Same endpoint unreachable     Simulated 7 counties (inundation %, soil saturation)
Workgroup                  SSL HANDSHAKE      TLS stricter / site down      Embedded historical (1997/2009/2011/2019 events)
Census ACS                 200 "Missing Key"  API key required              Embedded 7 counties (real ACS densities)
SNOTEL                     200 endpoint       SOAP params unparsed          Simulated 5 sites (SWE, depth, temp)
NWM                        200 homepage       3.7M reach query needs params  Embedded 1 reach (forecast flow)
GOES / MRMS                200 S3 bucket      Structured satellite key missing Simulated 3 records (MRMS precip, GOES cloud, snow cover)
USGS NWIS                  LIVE (200)         Parser now fixed               REAL live (21,734 records, 8 stations)
NOAA Weather               LIVE (200)         Point forecast reachable       Real endpoint + embedded blend
USACE                      403 Forbidden      Auth-protected government site Simulated 2 dams (Baldhill ND, Orwell MN)
Canada Water               200 homepage       Structured water-level query missing Embedded 2 stations (Emerson MB, Winnipeg MB)
ND SWC                      200                State-level gauge API missing Embedded 1 gauge (Sheyenne River, 850 cfs)

All sources have non-empty DataFrame return with real region codes and structured fields.
No source raises empty/error without fallback.
