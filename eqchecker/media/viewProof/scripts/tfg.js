import {convert_long_long_map_json_to_associative_array,get_numeric_suffix} from "./utils.js";


const default_columnname_for_assembly = 16;
const default_columnname_for_ir = 10;


function dst_asm_compute_index_to_line_map_helper(index, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map)
{
  const dst_pc = dst_insn_pcs[index];
  if (dst_pc in dst_pc_to_assembly_index_map) {
    const assembly_index = dst_pc_to_assembly_index_map[dst_pc];
    if (assembly_index in dst_assembly_index_to_assembly_line_map) {
      const assembly_line = dst_assembly_index_to_assembly_line_map[assembly_index];
      //console.log(`index ${index}, dst_pc ${dst_pc}, assembly_index ${assembly_index}, assembly_line ${assembly_line}\n`);
      return assembly_line;
    }
  }
  return undefined;
}

export function dst_asm_compute_index_to_line_map(dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map)
{
  var ret = {};
  for (var oi in dst_insn_pcs) {
    var found = false;
    //console.log(`looking at insn index ${oi}\n`);
    for (var i = oi; i < dst_insn_pcs.length; i++) {
      const linename = dst_asm_compute_index_to_line_map_helper(i, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);
      if (linename !== undefined) {
        ret[oi] = linename;
        found = true;
        break;
      }
    }
    if (found) {
      continue;
    }
    for (var i = oi; i >= 0; i--) {
      const linename = dst_asm_compute_index_to_line_map_helper(i, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map);
      if (linename !== undefined) {
        ret[oi] = linename;
        found = true;
        break;
      }
    }
    if (!found) {
      ret[oi] = 0; //this should not be reached
    }
  }
  //console.log(`computed index_to_assembly_line_map (size ${ret.length}) =\n`);
  //for (var key in ret) {
  //  const val = ret[key];
  //  console.log(`${key} -> ${val}`);
  //}
  return ret;
}

export function tfg_asm_obtain_line_and_column_names_for_pc(dst_tfg_asm, dst_pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map)
{
  var dst_insn_pc, dst_linename, dst_columnname, dst_line_and_column_names;
  const dst_index = dst_pc.split('%')[0];
  if (dst_pc === 'L0%0%d') {
    dst_insn_pc = ""; //unused
    dst_linename = ""; //unused
    dst_columnname = ""; //unused
    dst_line_and_column_names = dst_linename; //unused
  } else if (dst_index.charAt(0) === 'L') {
    const index_name = get_numeric_suffix(dst_index.substring(1));
    dst_insn_pc = dst_insn_pcs[index_name];
    //console.log(`before: dst_insn_pc = ${dst_insn_pc}`);
    dst_insn_pc = parseInt(dst_insn_pc);
    //console.log(`after: dst_insn_pc = ${dst_insn_pc}`);
    dst_insn_pc = "0x" + dst_insn_pc.toString(16);
    //console.log(`after: dst_insn_pc = ${dst_insn_pc}`);
    dst_linename = dst_insn_index_to_assembly_line_map[index_name];

    dst_columnname = default_columnname_for_assembly;
    dst_line_and_column_names = dst_linename + dst_columnname;
  } else {
    dst_insn_pc = ""; //unused
    dst_linename = ""; //unused
    dst_columnname = ""; //unused
    dst_line_and_column_names = dst_linename; //unused
  }
  return [dst_insn_pc, dst_linename, dst_columnname, dst_line_and_column_names];
}



export function tfg_llvm_obtain_subprogram_info(tfg_llvm)
{
  return [tfg_llvm.llvm_subprogram_debug_info, tfg_llvm.llvm_ir_subprogram_debug_info];
}

export function tfg_asm_obtain_subprogram_info(tfg_asm, assembly)
{
  return {line: 0, scope_line: 0};
}

//export function get_ir_node_map(proptree_nodes, tfg_llvm)
//{
//  var ret = {};
//  proptree_nodes.forEach(element => {
//    var linename, columnname;
//    if (tfg_llvm !== undefined) {
//      [linename, columnname] = tfg_llvm_obtain_ir_line_and_column_names_for_pc(tfg_llvm, element.pc);
//    }
//    const entry = {pc: element.pc, linename: linename, columnname: columnname};
//    ret[entry.pc] = entry;
//  });
//  return ret;
//}

//export function get_src_dst_node_map(proptree_nodes, tfg_llvm, tfg_asm, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map)
//{
//  var ret = {};
//  //if (tfg_llvm === null) {
//  //  ret["syntax_type"] = "asm";
//  //} else {
//  //  ret["syntax_type"] = "C/llvm";
//  //}
//  proptree_nodes.forEach(element => {
//    var linename, columnname, line_and_column_names, insn_pc;
//    if (tfg_llvm === undefined) {
//      [insn_pc, linename, columnname, line_and_column_names] = tfg_asm_obtain_line_and_column_names_for_pc(tfg_asm, element.pc, dst_assembly, dst_insn_pcs, dst_pc_to_assembly_index_map, dst_assembly_index_to_assembly_line_map, dst_insn_index_to_assembly_line_map);
//    } else {
//      [linename, columnname, line_and_column_names] = tfg_llvm_obtain_line_and_column_names_for_pc(tfg_llvm, element.pc);
//    }
//    const entry = {pc: element.pc, linename: linename, columnname: columnname, line_and_column_names: line_and_column_names, insn_pc: insn_pc};
//    ret[entry.pc] = entry;
//  });
//  return ret;
//}

export function obtain_insn_arrays_from_eqcheck_info(eqcheck_info, srcdst)
{
  const assembly = (srcdst == "dst") ? eqcheck_info["dst_assembly"] : undefined;
  const insn_pcs = (srcdst == "src" || assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_insn_pcs_for_gui"]);
  const pc_to_assembly_index_map = (srcdst == "src" || assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_pc_to_assembly_index_map"]);
  const assembly_index_to_assembly_line_map = (srcdst == "src" || assembly==="") ? undefined : convert_long_long_map_json_to_associative_array(eqcheck_info["dst_assembly_index_to_assembly_line_map"]);
  const insn_index_to_assembly_line_map = (srcdst == "src" || assembly==="") ? undefined : dst_asm_compute_index_to_line_map(insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map);

  return [assembly, insn_pcs, pc_to_assembly_index_map, assembly_index_to_assembly_line_map, insn_index_to_assembly_line_map];
}

// export function tfg_llvm_obtain_ir_line_and_column_names_for_pc(tfg_llvm, pc)
// {
//  var ir_linename;
//  const ir_linename_map = tfg_llvm["ir_linename_map"];
//  if (ir_linename_map === undefined) {
//    return [0,0];
//  }

//  const index = pc.split('%')[0];
//  if (index.charAt(0) === 'L' && pc !== 'L0%0%d') {
//    var pc_components = pc.split('%');
//    pc_components[2] = "d";
//    const pc_default_subsubindex = pc_components.join('%');

//    ir_linename = line_column_map_get_value_for_pc(ir_linename_map, pc_default_subsubindex, "ir_linename");
//  } else {
//    ir_linename = ""; //unused
//  }
//  return [ir_linename, default_columnname_for_ir];
// }

export function tfg_llvm_obtain_LL_linenum_for_pc(src_tfg_llvm, src_pc)
{
  const ll_linenum_map = src_tfg_llvm["ll_filename_linenum_map"];
  if (ll_linenum_map === undefined) {
    //console.log(`returning [0,0] because could not find ll_linename_map`);
    return [0, 0];
  }
  var linenum;
  const index = src_pc.split('%')[0];
  if (index.charAt(0) === 'L') {
    var pc_components = src_pc.split('%');
    pc_components[2] = "d";
    const pc_default_subsubindex = pc_components.join('%');

    linenum = line_column_map_get_value_for_pc(ll_linenum_map, pc_default_subsubindex, "ll_filename_linenum");
  }
  if (linenum === undefined) {
    //console.log(`returning [0,0] because linenum is undefined for ${src_pc}`);
    linenum = line_column_map_get_value_for_pc(ll_linenum_map, 'L0%0%d', "ll_filename_linenum");
  }
  //console.log(`linenum = ${linenum} for ${src_pc}`);
  return [linenum, default_columnname_for_ir];
}

export function tfg_llvm_obtain_line_and_column_names_for_pc(src_tfg_llvm, src_pc)
{
  var src_linename, src_columnname, src_line_and_column_names;

  const src_linename_map = src_tfg_llvm["linename_map"];
  const src_columnname_map = src_tfg_llvm["columnname_map"];
  const src_line_and_column_names_map = src_tfg_llvm["line_and_column_names_map"];

  const src_index = src_pc.split('%')[0];
  if (src_pc === 'L0%0%d') {
    src_linename = ""; //unused
    src_columnname = ""; //unused
    src_line_and_column_names = src_linename; //unused
  } else if (src_index.charAt(0) === 'L') {
    var pc_components = src_pc.split('%');
    pc_components[2] = "d";
    const src_pc_default_subsubindex = pc_components.join('%');

    const linename_prefix = "line ";
    src_linename = line_column_map_get_value_for_pc(src_linename_map, src_pc_default_subsubindex, "linename");
    if (src_linename !== undefined) {
      src_linename = src_linename.substring(linename_prefix.length);
    } else {
      console.log(`src_linename is undefined for ${src_pc_default_subsubindex}`);
    }

    const columnname_prefix = " at column ";
    src_columnname = line_column_map_get_value_for_pc(src_columnname_map, src_pc_default_subsubindex, "columnname");
    if (src_columnname !== undefined) {
      src_columnname = src_columnname.substring(columnname_prefix.length);
    } else {
      console.log(`src_columnname is undefined for ${src_pc_default_subsubindex}`);
    }

    src_line_and_column_names = line_column_map_get_value_for_pc(src_line_and_column_names_map, src_pc_default_subsubindex, "line_and_column_names");
    //if (src_linename === undefined) {
    //  console.log(`src_pc_default_subsubindex = ${src_pc_default_subsubindex}\n`);
    //  console.log("src_linename_map =\n");
    //  for (let [key, value] of src_linename_map.entries()) {
    //  	console.log(key + " = " + value)
    //  }
    //}
  } else {
    src_linename = ""; //unused
    src_columnname = ""; //unused
    src_line_and_column_names = src_linename; //unused
  }
  return [src_linename, src_columnname, src_line_and_column_names];
}

function line_column_map_get_value_for_pc(proptree, p, key)
{
  //console.log("proptree =\n" + JSON.stringify(proptree));
  const arr = proptree[key];
  //console.log("key = " + key + ", arr =\n" + JSON.stringify(arr));
  for (var i = 0; i < arr.length; i++) {
    //console.log("d2=\n" + JSON.stringify(d2));
    if (arr[i].pc === p) {
      return arr[i].string;
    }
  }
  return undefined;
}


