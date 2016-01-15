/**
 Copyright 2014 Gordon Williams (gw@pur3.co.uk)

 This Source Code is subject to the terms of the Mozilla Public
 License, v2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.
 
 ------------------------------------------------------------------
  CodeMirror JavaScript editor
 ------------------------------------------------------------------
**/
"use strict";
(function(){
  var codeMirror;
  var codeMirrorDirty = false;
  
  function init() {    
    $('<div id="divcode" style="width:100%;height:100%;"><textarea id="code" name="code"></textarea></div>').appendTo(".editor--code .editor__canvas");
    // The code editor
    codeMirror = CodeMirror.fromTextArea(document.getElementById("code"), {
      width: "100%",
      height: "100%",
      lineNumbers: true,
      matchBrackets: true,
      mode: {name: "javascript", globalVars: false},
      lineWrapping: true,
      showTrailingSpace: true,
      lint: {
        es5         : true, // if ES5 syntax should be allowed
        evil        : true, // don't warn on use of strings in setInterval
        laxbreak    : true,  // don't warn about newlines in expressions
        laxcomma    : true  // don't warn about commas at the start of the line
      },
      highlightSelectionMatches: {showToken: /\w/},
      foldGutter: {rangeFinder: new CodeMirror.fold.combine(CodeMirror.fold.brace, CodeMirror.fold.comment)},
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
      extraKeys: {
        "Tab" : function(cm) { 
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else { // make sure the tab key indents with spaces
            cm.replaceSelection(cm.getOption("indentWithTabs")? "\t":
              Array(cm.getOption("indentUnit") + 1).join(" "), "end", "+input");
          }
        }
      }
    });
	

	Espruino.Core.Config.add("BLOCKLY_SHOW_HSCROLL", {
      section : "General",
      name : "Line wrapping",
      description : "Set when you want to keep long code lines on the same line?",
      type : "boolean",
      defaultValue : false, 
	  onChange : function(toggle) { toggleCodemirrorLineWrapping(toggle); }
    });   
	
	function toggleCodemirrorLineWrapping(useLineWrapping) {
		if (useLineWrapping) {
			if ($('#codemirrorLineWrapping')) {
				$('#codemirrorLineWrapping').remove();
			}
		}
		else {
			$('head').append('<style id="codemirrorLineWrapping">.CodeMirror-wrap pre { word-wrap: break-word;white-space: pre-wrap;word-break: normal; }</style>');
		}
	}
	
	// get code from our config area at bootup
    Espruino.addProcessor("initialised", function(data,callback) {
	  if (Espruino.Config.BLOCKLY_SHOW_HSCROLL) {
		CodeMirror.defaults.lineWrapping = true;
      }
	  else {
		$('head').append('<style id="codemirrorLineWrapping">.CodeMirror-wrap pre { word-wrap: break-word;white-space: pre-wrap;word-break: normal; }</style>');
		CodeMirror.defaults.lineWrapping = false;
	  }
    });
	
    // When things have changed...
    codeMirror.on("change", function(cm, changeObj) {
      // If pasting, make sure we ignore `&shy;` - which gets inserted
      // by the forum's code formatter
	  console.dir(cm)
	  console.dir(changeObj)
      if (changeObj.origin == "paste" && cm.getValue().indexOf("\u00AD")>=0) {
        var c = cm.getCursor();
        cm.setValue(cm.getValue().replace(/\u00AD/g,''));
        cm.setCursor(c);
      }
      // write the modified code into local storage
      if ((typeof chrome!="undefined") && chrome.storage && chrome.storage.local)
        chrome.storage.local.set({"CODE_JS": cm.getValue()});
    });
    // Handle hovering
    CodeMirror.on(codeMirror.getWrapperElement(), "mouseover", function(e) {
      var node = e.target || e.srcElement;
      if (node) {
        var stillInNode = true;
        CodeMirror.on(node, "mouseout", function mo() {
          CodeMirror.off(node, "mouseout", mo);
          stillInNode = false;
        });
        Espruino.callProcessor("editorHover", { 
          node : node,
          showTooltip : function(htmlNode) {
            if (stillInNode) showTooltipFor(e, htmlNode, node);
          }
        });
      }      
    });
  }
  

  function getCode() {
    return codeMirror.getValue();
  }
  
  function setCode(code) {
    codeMirror.setValue(code);    
    codeMirrorDirty = true;
  }

  /** Called this when we switch modes from blockly - the editor needs a prod to update if the code
   * was set when it was invisible */
  function madeVisible() {
    if (codeMirrorDirty) {
      codeMirrorDirty = false;
      // important we do it a bit later so things have had time to lay out
      setTimeout(function () {
        codeMirror.refresh();
      }, 1);
    }
  }
  
  // --------------------------------------------------------------------------
  // Stolen from codemirror's lint.js (not exported :( )
  // --------------------------------------------------------------------------
  
  function showTooltip(e, content) {
    var tt = document.createElement("div");
    tt.className = "CodeMirror-lint-tooltip";
    tt.appendChild(content.cloneNode(true));
    document.body.appendChild(tt);

    function position(e) {
      if (!tt.parentNode) return CodeMirror.off(document, "mousemove", position);
      tt.style.top = Math.max(0, e.clientY - tt.offsetHeight - 5) + "px";
      tt.style.left = (e.clientX + 5) + "px";
    }
    CodeMirror.on(document, "mousemove", position);
    position(e);
    if (tt.style.opacity != null) tt.style.opacity = 1;
    return tt;
  }
  function rm(elt) {
    if (elt.parentNode) elt.parentNode.removeChild(elt);
  }
  function hideTooltip(tt) {
    if (!tt.parentNode) return;
    if (tt.style.opacity == null) rm(tt);
    tt.style.opacity = 0;
    setTimeout(function() { rm(tt); }, 600);
  }

  function showTooltipFor(e, content, node) {
    var tooltip = showTooltip(e, content);
    function hide() {
      CodeMirror.off(node, "mouseout", hide);
      if (tooltip) { hideTooltip(tooltip); tooltip = null; }
    }
    var poll = setInterval(function() {
      if (tooltip) for (var n = node;; n = n.parentNode) {
        if (n == document.body) return;
        if (!n) { hide(); break; }
      }
      if (!tooltip) return clearInterval(poll);
    }, 400);
    CodeMirror.on(node, "mouseout", hide);
  }
  
  //--------------------------------------------------------------------------
  //--------------------------------------------------------------------------
  //--------------------------------------------------------------------------
  
  Espruino.Core.EditorJavaScript = {
    init : init,
    getCode : getCode,
    setCode : setCode,
    madeVisible : madeVisible,
    getCodeMirror : function () { return codeMirror; }
  };
}());
