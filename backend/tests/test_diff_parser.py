from app.diff_parser import parse_diff

DIFF = """diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -10,4 +10,5 @@ export function f() {
 ctx
-old
+new1
+new2
 ctx2
@@ -30,2 +31,3 @@
 c
+added
 d
diff --git a/b.py b/b.py
new file mode 100644
--- /dev/null
+++ b/b.py
@@ -0,0 +1,2 @@
+x = 1
+y = 2
"""


def test_line_mapping():
    files = parse_diff(DIFF)
    assert [f.path for f in files] == ["src/a.ts", "b.py"]
    assert files[0].added == {11: "new1", 12: "new2", 32: "added"}
    assert files[1].lines == [1, 2]
