' Starts KPR Pitstop without showing a black console window.
' Optional argument: --server-only  or  --stop
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
extra = ""
If WScript.Arguments.Count > 0 Then extra = " " & WScript.Arguments(0)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run """" & dir & "\node\node.exe"" """ & dir & "\launcher.js""" & extra, 0, False
