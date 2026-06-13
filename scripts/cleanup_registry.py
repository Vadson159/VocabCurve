import json
import os

USER_DATA_PATH = "user-data.json"

def clean_registry():
    if not os.path.exists(USER_DATA_PATH):
        print(f"{USER_DATA_PATH} not found.")
        return

    with open(USER_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    
    # 1. Clean `registries`
    if "registries" in data:
        for lang in data["registries"]:
            original_list = data["registries"][lang]
            new_list = []
            for item in original_list:
                file_path = item.get("file", "").replace("./", "")
                
                # Check actual existence of the file
                # The file might be generated in the frontend web/public but path says cache/
                # Let's check a few possible locations
                possible_paths = [
                    file_path,
                    os.path.join("web", "public", os.path.basename(file_path)),
                    os.path.join("cache", os.path.basename(file_path))
                ]
                
                exists = any(os.path.exists(p) for p in possible_paths)
                
                if exists:
                    new_list.append(item)
                else:
                    safe_id = item.get('id', '').encode('ascii', 'ignore').decode()
                    print(f"Removing phantom text: {safe_id}")
                    changed = True

            data["registries"][lang] = new_list

    # 2. Clean `vocabularies.<lang>.lexicometerChain`
    if "vocabularies" in data:
        for lang in data["vocabularies"]:
            if "lexicometerChain" in data["vocabularies"][lang]:
                chain = data["vocabularies"][lang]["lexicometerChain"]
                new_chain = []
                for step in chain:
                    if step.get("type") == "file":
                        file_path = step.get("file", "").replace("./", "")
                        possible_paths = [
                            file_path,
                            os.path.join("web", "public", os.path.basename(file_path)),
                            os.path.join("cache", os.path.basename(file_path))
                        ]
                        if any(os.path.exists(p) for p in possible_paths):
                            new_chain.append(step)
                        else:
                            safe_id = step.get('id', '').encode('ascii', 'ignore').decode()
                            print(f"Removing phantom from lexicometer: {safe_id}")
                            changed = True
                    else:
                        # Keep non-file steps (like operators +, -, etc.)
                        new_chain.append(step)
                data["vocabularies"][lang]["lexicometerChain"] = new_chain

    # 3. Clean root Level
    if "registry" in data:
        data["registry"] = [item for item in data["registry"] if item in data["registries"].get(data.get("targetLanguage", "german"), [])]
    
    if "lexicometerChain" in data:
        data["lexicometerChain"] = data.get("vocabularies", {}).get(data.get("targetLanguage", "german"), {}).get("lexicometerChain", [])

    if changed:
        with open(USER_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Successfully cleaned up phantom active texts.")
    else:
        print("No phantom active texts found to clean up.")

if __name__ == "__main__":
    clean_registry()
