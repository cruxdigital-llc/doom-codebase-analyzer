import os
import re
import json
from datetime import datetime
import logging
import argparse

def calculate_complexity(func_body):
    complexity = 1
    lines = func_body.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('if') or line.startswith('for') or line.startswith('while') or \
           line.startswith('&&') or line.startswith('||'):
            complexity += 1
    return complexity

def parse_functions(content):
    functions = []
    function_pattern = re.compile(r'(\w+(?:\s+\w+)*)\s+(\w+)\s*\(([^)]*)\)\s*{', re.MULTILINE | re.DOTALL)
    matches = function_pattern.finditer(content)

    for match in matches:
        function_name = match.group(2)
        return_type = match.group(1)
        parameters = parse_parameters(match.group(3))
        start_line = content[:match.start()].count('\n') + 1
        
        function_body = content[match.end():].split('\n')
        brace_count = 1
        end_line = start_line
        local_vars = []
        function_calls = []
        control_flow = []
        
        for i, line in enumerate(function_body):
            end_line += 1
            brace_count += line.count('{') - line.count('}')
            
            local_var_match = re.match(r'\s*(\w+(?:\s+\w+)*)\s+(\w+)(?:\[(\d+)\])?;', line)
            if local_var_match:
                local_vars.append({
                    "type": local_var_match.group(1),
                    "name": local_var_match.group(2),
                    "array_size": local_var_match.group(3),
                    "line_number": start_line + i + 1
                })
            
            func_calls = re.findall(r'\b(\w+)\s*\(', line)
            for func_call in func_calls:
                function_calls.append({
                    "name": func_call,
                    "line_number": start_line + i + 1
                })
            
            if re.search(r'\bif\b', line):
                control_flow.append({"type": "if", "line_number": start_line + i + 1})
            elif re.search(r'\belse\b', line):
                control_flow.append({"type": "else", "line_number": start_line + i + 1})
            elif re.search(r'\bfor\b', line):
                control_flow.append({"type": "for", "line_number": start_line + i + 1})
            elif re.search(r'\bwhile\b', line):
                control_flow.append({"type": "while", "line_number": start_line + i + 1})
            
            if brace_count == 0:
                break
        
        body = '\n'.join(function_body[:end_line - start_line])
        complexity = calculate_complexity(body)
        function_inputs = [param['name'] for param in parameters]
        function_outputs = [return_type] if return_type != 'void' else []
        function_dependencies = list(set(func_call['name'] for func_call in function_calls))

        functions.append({
            "name": function_name,
            "return_type": return_type,
            "parameters": parameters,
            "start_line": start_line,
            "end_line": end_line,
            "local_variables": local_vars,
            "function_calls": function_calls,
            "control_flow": control_flow,
            "complexity": complexity,
            "inputs": function_inputs,
            "outputs": function_outputs,
            "dependencies": function_dependencies
        })
        
        logging.debug(f"Found function: {function_name} at line {start_line}")

    return functions

def parse_parameters(params_str):
    params = []
    for param in params_str.split(','):
        param = param.strip()
        if param:
            param_parts = param.split()
            param_type = ' '.join(param_parts[:-1])
            param_name = param_parts[-1]
            params.append({"type": param_type, "name": param_name})
    return params

def parse_structs(content):
    structs = []
    lines = content.split('\n')
    in_struct = False
    current_struct = {}
    for i, line in enumerate(lines):
        if re.match(r'\s*struct\s+(\w+)\s*{', line):
            in_struct = True
            current_struct = {
                "name": re.match(r'\s*struct\s+(\w+)\s*{', line).group(1),
                "members": [],
                "start_line": i + 1
            }
        elif in_struct and re.match(r'\s*}\s*;', line):
            in_struct = False
            current_struct["end_line"] = i + 1
            structs.append(current_struct)
        elif in_struct:
            member_match = re.match(r'\s*(\w+(?:\s+\w+)*)\s+(\w+)(?:\[(\d+)\])?;', line)
            if member_match:
                current_struct["members"].append({
                    "type": member_match.group(1),
                    "name": member_match.group(2),
                    "array_size": member_match.group(3),
                    "line_number": i + 1
                })
    return structs

def parse_globals(content):
    globals = []
    lines = content.split('\n')
    global_pattern = re.compile(r'(extern|static)?\s*(\w+(?:\s+\w+)*)\s+(\w+)(?:\[(\d+)\])?;')
    for i, line in enumerate(lines):
        match = global_pattern.search(line)
        if match and not line.strip().startswith('#'):
            storage_class = match.group(1)
            type_name = match.group(2)
            var_name = match.group(3)
            array_size = match.group(4)
            globals.append({
                "name": var_name,
                "type": type_name,
                "storage_class": storage_class,
                "array_size": array_size,
                "line_number": i + 1
            })
    return globals

def parse_includes(content):
    includes = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        match = re.match(r'#include\s+[<"](.+)[>"]', line)
        if match:
            includes.append({
                "file": match.group(1),
                "line_number": i + 1
            })
    return includes

def parse_defines(content):
    defines = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        match = re.match(r'#define\s+(\w+)\s+(.+)', line)
        if match:
            defines.append({
                "name": match.group(1),
                "value": match.group(2).strip(),
                "line_number": i + 1
            })
    return defines

def traverse_codebase(directory):
    items = []
    for item in os.listdir(directory):
        item_path = os.path.join(directory, item)
        if os.path.isdir(item_path) and item != "CVS":
            children = traverse_codebase(item_path)
            if children:
                items.append({
                    "name": item,
                    "type": "directory",
                    "children": children
                })
        elif os.path.isfile(item_path):
            if should_ignore_file(item):
                logging.debug(f"Ignoring file: {item_path}")
            else:
                file_info = process_file(item_path)
                if file_info:
                    items.append(file_info)
    return items

def analyze_data_dependencies(content):
    dependencies = {}
    lines = content.split('\n')
    variable_pattern = re.compile(r'\b(\w+)\s*=')
    function_call_pattern = re.compile(r'\b(\w+)\s*\(')

    for i, line in enumerate(lines):
        variables = variable_pattern.findall(line)
        function_calls = function_call_pattern.findall(line)

        for var in variables:
            if var not in dependencies:
                dependencies[var] = {'used_in': [], 'modified_in': []}
            dependencies[var]['modified_in'].append(i + 1)

        for func in function_calls:
            if func not in dependencies:
                dependencies[func] = {'used_in': [], 'modified_in': []}
            dependencies[func]['used_in'].append(i + 1)

    return dependencies

def process_file(item_path):
    file_info = {
        "name": os.path.basename(item_path),
        "type": "file",
        "size": os.path.getsize(item_path),
        "last_modified": datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat(),
        "path": os.path.relpath(item_path, start=root_directory),
    }

    with open(item_path, 'r', encoding='utf-8', errors='ignore') as file:
        content = file.read()

    file_info["readme"] = generate_readme(item_path, content)
    file_info["dependencies"] = extract_dependencies(content)
    file_info["inputs"], file_info["outputs"] = extract_inputs_outputs(content)
    file_info["content"] = {
        "functions": parse_functions(content),
        "structs": parse_structs(content),
        "globals": parse_globals(content),
        "defines": parse_defines(content),
    }
    file_info["source_code_path"] = os.path.relpath(item_path, start=root_directory)

    file_inputs = list(set([param['name'] for func in file_info["content"]["functions"] for param in func['parameters']]))
    file_outputs = list(set([func['return_type'] for func in file_info["content"]["functions"] if func['return_type'] != 'void']))
    file_dependencies = list(set([include.strip('"<>') for include in file_info["dependencies"]]))

    file_info["inputs"] = file_inputs
    file_info["outputs"] = file_outputs
    file_info["dependencies"] = file_dependencies
    file_info["refactoring_potential"] = "To be analyzed by LLM"
    file_info["optimization_opportunities"] = detect_optimization_opportunities(file_info)

    return file_info

def generate_readme(file_path, content):
    file_name = os.path.basename(file_path)
    return f"# {file_name}\n\nThis file contains functionality related to {file_name.split('.')[0]}."

def extract_dependencies(content):
    includes = re.findall(r'#include\s+[<"](.+?)[>"]', content)
    return list(set(includes))

def extract_inputs_outputs(content):
    inputs = re.findall(r'\b(argv|argc|fgets|scanf|getchar)\b', content)
    outputs = re.findall(r'\b(printf|fprintf|puts|putchar)\b', content)
    return list(set(inputs)), list(set(outputs))

def analyze_function_calls_and_types(content):
    function_calls = []
    type_usage = {}
    type_declarations = []
    
    func_call_pattern = re.compile(r'\b(\w+)\s*\([^)]*\)')
    type_decl_pattern = re.compile(r'\b(int|char|float|double|void|short|long|unsigned|struct\s+\w+)\s+(\w+)')
    func_decl_pattern = re.compile(r'\b(int|char|float|double|void|short|long|unsigned|struct\s+\w+)\s+(\w+)\s*\([^)]*\)\s*{')
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        for match in func_call_pattern.finditer(line):
            function_calls.append({
                "name": match.group(1),
                "line_number": i + 1
            })
        
        for match in type_decl_pattern.finditer(line):
            type_name = match.group(1)
            var_name = match.group(2)
            
            if type_name not in type_usage:
                type_usage[type_name] = []
            type_usage[type_name].append({
                "name": var_name,
                "line_number": i + 1
            })
            
            if not func_decl_pattern.search(line):
                type_declarations.append({
                    "type": type_name,
                    "name": var_name,
                    "line_number": i + 1
                })
    
    return {
        "function_calls": function_calls,
        "type_usage": type_usage,
        "type_declarations": type_declarations
    }

def handle_preprocessor_directives(content):
    directives = []
    macro_definitions = {}
    included_files = []
    conditional_compilation = []

    lines = content.split('\n')
    for i, line in enumerate(lines):
        line = line.strip()
        if line.startswith('#'):
            parts = line.split(None, 1)
            directive = parts[0][1:]
            args = parts[1] if len(parts) > 1 else ""

            directives.append({
                "type": directive,
                "args": args,
                "line_number": i + 1
            })

            if directive == 'define':
                macro_parts = args.split(None, 1)
                macro_name = macro_parts[0]
                macro_value = macro_parts[1] if len(macro_parts) > 1 else None
                macro_definitions[macro_name] = {
                    "value": macro_value,
                    "line_number": i + 1
                }

            elif directive == 'include':
                included_files.append({
                    "file": args.strip('"<>'),
                    "line_number": i + 1
                })

            elif directive in ['ifdef', 'ifndef', 'if', 'elif', 'else', 'endif']:
                conditional_compilation.append({
                    "type": directive,
                    "condition": args,
                    "line_number": i + 1
                })

    return {
        "preprocessor_directives": directives,
        "macro_definitions": macro_definitions,
        "included_files": included_files,
        "conditional_compilation": conditional_compilation
    }

def detect_long_functions(functions, threshold=100):
    long_functions = []
    for func in functions:
        if func['end_line'] - func['start_line'] > threshold:
            long_functions.append({
                'name': func['name'],
                'lines': func['end_line'] - func['start_line']
            })
    return long_functions

def should_ignore_file(filename):
    ignore_patterns = [
        r'^README.*',
        r'^FILES\d*$',
        r'^TODO$',
        r'^ChangeLog$',
        r'\.h\.gch$',
        r'^CVS/Entries$'
    ]
    return any(re.search(pattern, filename, re.IGNORECASE) for pattern in ignore_patterns)

def process_makefile(item_path):
    makefile_info = {
        "name": os.path.basename(item_path),
        "type": "makefile",
        "size": os.path.getsize(item_path),
        "last_modified": datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat(),
        "targets": [],
        "variables": [],
        "includes": []
    }

    with open(item_path, 'r', encoding='utf-8', errors='ignore') as file:
        content = file.read()
        
    targets = re.findall(r'^([^:\s]+):', content, re.MULTILINE)
    makefile_info["targets"] = targets

    variables = re.findall(r'^(\w+)\s*=', content, re.MULTILINE)
    makefile_info["variables"] = variables

    includes = re.findall(r'^include\s+(.+)$', content, re.MULTILINE)
    makefile_info["includes"] = includes

    return makefile_info

def process_changelog(item_path):
    changelog_info = {
        "name": "ChangeLog",
        "type": "file",
        "size": os.path.getsize(item_path),
        "last_modified": datetime.fromtimestamp(os.path.getmtime(item_path)).isoformat(),
        "path": os.path.relpath(item_path, start=root_directory),
        "entries": []
    }

    with open(item_path, 'r', encoding='utf-8', errors='ignore') as file:
        content = file.read()
        
    # Parse ChangeLog entries
    entry_pattern = re.compile(r'^(\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2} \d{4})\s+(.+?)\n((?:(?!\n\w{3} \w{3}).+\n)*)', re.MULTILINE)
    entries = entry_pattern.findall(content)
    
    for date, author, changes in entries:
        changelog_info["entries"].append({
            "date": date,
            "author": author,
            "changes": changes.strip().split('\n')
        })

    return changelog_info

def detect_optimization_opportunities(file_info):
    opportunities = []
    if len(file_info["content"]["functions"]) > 20:
        opportunities.append("High number of functions")
    if any(func["complexity"] > 15 for func in file_info["content"]["functions"]):
        opportunities.append("Functions with high cyclomatic complexity")
    if len(file_info["content"]["globals"]) > 10:
        opportunities.append("High number of global variables")
    return opportunities

def main():
    parser = argparse.ArgumentParser(description="Parse DOOM codebase")
    parser.add_argument("--input", default="./source-original", help="Input directory path")
    parser.add_argument("--output", default="./doom_codebase_structure.json", help="Output JSON file path")
    parser.add_argument("--log-file", default="./doom_codebase_parsing_errors.log", help="Log file path")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], help="Set the logging level")
    args = parser.parse_args()

    # Delete the previous log file if it exists
    if os.path.exists(args.log_file):
        os.remove(args.log_file)
        print(f"Deleted previous log file: {args.log_file}")

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(levelname)s - %(message)s',
        filename=args.log_file,
        filemode='w'
    )

    global root_directory
    root_directory = os.path.abspath(args.input)
    output_file = args.output

    codebase_json = {
        "name": "DOOM",
        "type": "directory",
        "root_directory": root_directory,
        "children": traverse_codebase(root_directory)
    }
    
    if os.path.exists(output_file):
        os.remove(output_file)
        logging.info(f"Deleted previous {output_file}")

    with open(output_file, 'w') as outfile:
        json.dump(codebase_json, outfile, indent=2)

    logging.info(f"Parsing complete. Output written to {output_file}")
    print(f"Parsing complete. Output written to {output_file}")
    print(f"Log file written to {args.log_file}")

if __name__ == "__main__":
    main()