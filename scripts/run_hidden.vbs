Set WshShell = CreateObject("WScript.Shell")
args = ""
For i = 0 to WScript.Arguments.Count - 1
    arg = WScript.Arguments(i)
    If InStr(arg, " ") > 0 Then arg = """" & arg & """"
    args = args & arg & " "
Next
WshShell.Run Trim(args), 0, False
