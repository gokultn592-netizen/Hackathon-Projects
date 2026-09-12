import re

with open('src/frontend/FloodCommandCenter.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines()

issues = []

# 1. Check DISTRICT_NAME_MAP consistency
map_start = None
map_end = None
for i, line in enumerate(lines):
    if 'DISTRICT_NAME_MAP' in line:
        map_start = i
    if map_start is not None and line.strip() == '};' and i > map_start:
        map_end = i
        break
map_entries = {}
if map_start is not None:
    for i in range(map_start, map_end+1):
        m = re.search(r'District_(\w+):\s*"([^"]+)"', lines[i])
        if m:
            map_entries[m.group(1)] = m.group(2)

# 2. Check DISTRICT_BASE_PROFILES names
profile_names = re.findall(r'district_id:\s*"([^"]+)"', content)

# Mismatch between map values and profile names
map_values = list(map_entries.values())
profile_set = set(profile_names)
map_set = set(map_entries.values())
missing_in_map = profile_set - map_set
missing_in_profiles = map_set - profile_set

if missing_in_map:
    issues.append(f"Profiles not in DISTRICT_NAME_MAP: {missing_in_map}")
if missing_in_profiles:
    issues.append(f"DISTRICT_NAME_MAP values not in profiles: {missing_in_profiles}")

# 3. Check INITIAL_ALLOCATIONS
alloc_start = None
for i, line in enumerate(lines):
    if 'INITIAL_ALLOCATIONS = [' in line:
        alloc_start = i
alloc_names = []
for i in range(alloc_start, min(alloc_start+20, len(lines))):
    m = re.search(r'district_id:\s*"([^"]+)"', lines[i])
    if m:
        alloc_names.append(m.group(1))
alloc_set = set(alloc_names)
if profile_set != alloc_set:
    issues.append(f"INITIAL_ALLOCATIONS mismatch with profiles: profiles={profile_set}, allocs={alloc_set}")

# 4. Check selectedDistrictId default
if 'useState("Shreveport")' not in content:
    if 'useState("Patna")' in content:
        issues.append("Default selectedDistrictId still 'Patna'")
    else:
        issues.append("Default selectedDistrictId not set to Shreveport")

# 5. Check useless buttons / missing handlers
buttons = re.findall(r'onClick=\{(\w+)', content)
button_refs = set()
# Check if all referenced handlers exist
handlers = ['handleCollectData', 'handleRunPredict', 'handleOptimizeResources', 'handleRunFullPipeline', 'checkHealth', 'setSitRepModalOpen', 'setDetailModalOpen', 'setActiveTab', 'setSelectedDistrictId', 'setLayerVisibility']
for h in handlers:
    if h not in content and h.startswith('set'):
        # setState functions are different; skip checking them
        pass
    elif h.startswith('handle') or h == 'checkHealth':
        if h not in content:
            issues.append(f"Button references missing handler: {h}")

# 6. Check leftover references
leftover_refs = ['Bihar', 'Patna', 'Bhagalpur', 'Darbhanga', 'Muzaffarpur', 'Sitamarhi', 'Supaul', 'Madhubani', 'Katihar', 'Ganga (Digha', 'IMD', 'Bhuvan', 'AIIMS Patna', 'JLNMCH', 'SKMCH', 'SH-', 'NH-', 'BSDMA', 'NDMA']
for ref in leftover_refs:
    if ref in content:
        # Filter out cases where it might be a replacement that kept part (e.g., "Red River" contains nothing)
        issues.append(f"Leftover reference found: '{ref}'")

# 7. Check for broken syntax or undefined variables
# Look for variables that may be undefined
for var in ['INITIAL_SIMULATION_DISTRICTS', 'DISTRICT_BASE_PROFILES', 'DISTRICT_NAME_MAP', 'API_BASE_URL']:
    if var not in content:
        issues.append(f"Missing variable definition: {var}")

# 8. Check button labels for consistency
# Look for any button that says something unrelated to Red River Basin
bad_labels = []
for i, line in enumerate(lines):
    if 'Bihar' in line or 'Patna' in line or 'Ganga' in line:
        bad_labels.append(f"Line {i+1}: {line.strip()}")
if bad_labels:
    for b in bad_labels:
        issues.append(b)

# Print results
print(f"Total lines: {len(lines)}")
print(f"DISTRICT_NAME_MAP entries: {map_entries}")
print(f"Profile district_ids: {profile_set}")
print(f"Allocation district_ids: {alloc_set}")
print("\n=== ISSUES FOUND ===")
if not issues:
    print("No issues found!")
else:
    for idx, issue in enumerate(issues, 1):
        print(f"{idx}. {issue}")
