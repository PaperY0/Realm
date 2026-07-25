diff --git a/src/styles.css b/src/styles.css
index 95ca6c4..9a3938a 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -4557,6 +4557,10 @@ body[data-stage="expression"] .paper-boat-sequence[data-paper-boat-state="error"
 }
 
 @media (max-width: 820px) {
+  body[data-stage="expression"] .scene--foyer {
+    display: none;
+  }
+
   body[data-stage="expression"] .scene--expression {
     height: 100dvh;
     padding: 72px 10px 48px;
