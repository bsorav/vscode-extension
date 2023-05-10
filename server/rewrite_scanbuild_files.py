import re

# Open the HTML file
with open('index.orig.html', 'r') as f:
  html = f.read()

dirName = "ABCDEFGHI"

# Define the regular expression pattern to match links
head_pattern = re.compile(r'<head>')
css_pattern = re.compile(r'<link type="text/css" rel="stylesheet" href="([^"]+)"/>')
script_pattern = re.compile(r'<script src="([^"]+)"></script>')
link_pattern = re.compile(r'href=["\']([^"\']+)["\']')
footnote_pattern = re.compile(r'Please consider submitting preprocessed files as <a href="http://clang-analyzer.llvm.org/filing_bugs.html">bug reports</a>')

def add_linkClicked(match):
  matchStr = match.group(0)
  header = """<script language='javascript' type="text/javascript">
  const vscode = acquireVsCodeApi();
  function linkClicked(filename)
  {
    //console.log(`linkClicked with filename ${filename}`);
    vscode.postMessage({ command: 'linkClicked', dirPath: \'"""
  remaining = """', filename: filename});
    //console.log(`eqcheckViewScanReport posted ${filename}`);
  }</script>"""
  return matchStr + header + dirName + remaining

def inline_css(match):
  css_link = match.group(0)
  css_filename = match.group(1)
  #print "matched css:\n" + css_link
  with open(css_filename, 'r') as css_file:
    css_contents = css_file.read();
  header = "<style type=\"text/css\">\n"
  footer = "\n</style>"
  return header + css_contents + footer

def inline_script(match):
  script_tag = match.group(0)
  script_filename = match.group(1)
  #print "matched css:\n" + css_link
  with open(script_filename, 'r') as script_file:
    script_contents = script_file.read();
  header = "<script language=\'javascript\' type=\'text/javascript\'>\n"
  footer = "\n</script>"
  return ""
  #return header + script_contents + footer

def remove_footnote(match):
  return ""

def replace_link(match):
  url = match.group(1)
  return "href=\"" + url + "\" onclick=\"linkClicked('" + url + "');\""
#old_link = match.group(1)
#new_link = old_link.replace('http://oldurl.com', 'https://newurl.com')
#return 'href="{}"'.format(new_link)

# Replace all links in the HTML file
new_html = head_pattern.sub(add_linkClicked, html)
new_html = css_pattern.sub(inline_css, new_html)
new_html = script_pattern.sub(inline_script, new_html)
new_html = footnote_pattern.sub(remove_footnote, new_html)
new_html = link_pattern.sub(replace_link, new_html)

# Write the modified HTML file
with open('index.html', 'w') as f:
  f.write(new_html)
