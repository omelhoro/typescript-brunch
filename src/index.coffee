fs = require("fs")
sysPath = require("path")
io = require("./io")

TypeScript = require("./typescript")
TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous

nulloutput =
    Write: (value) ->
    WriteLine: (value) ->
    Close: -> 

module.exports = class TypeScriptCompiler
  brunchPlugin: yes
  type: 'javascript'
  extension: 'ts'

  constructor: (@config) ->
    @settings = new TypeScript.CompilationSettings()
    @settings.codeGenTarget = TypeScript.CodeGenTarget.ES5
    @settings.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous
    @settings.resolve = false
    
  compile: (data, path, callback) ->
    try
        js = ""
        output =
            Write: (value) ->
              js += value
            WriteLine: (value) ->
              js += value + "\n"
            Close: ->

        # Snippet borrowed from Ekin Koc (https://github.com/eknkc/typescript-require)

        compiler = new TypeScript.TypeScriptCompiler(null, null, new TypeScript.NullLogger(), @settings)
        compiler.parser.errorRecovery = true
        env = new TypeScript.CompilationEnvironment(@settings, io)
        resolver = new TypeScript.CodeResolver(env)

        units = [{fileName: sysPath.join __dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts"}]
    
        path = TypeScript.switchToForwardSlashes path

        resolver.resolveCode path, "", false,
          postResolution: (file, code) =>
              depPath = TypeScript.switchToForwardSlashes code.path
              if(!(units.some (u) -> u.fileName is depPath))
                units.push
                  fileName: depPath
                  code: code.content
          postResolutionError: (file, message) ->
            throw new Error("TypeScript Error: " + message + "\n File: " + file)

        compiler.setErrorCallback (start, len, message, block) ->
          code = units[block].code
          line = [
            code.substr(0, start).split("\n").slice(-1)[0].replace(/^\s+/, ""), 
            code.substr(start, len), code.substr(start + len).split("\n").slice(0, 1)[0].replace(/\s+$/, "")
          ]
          underline = [
            line[0].replace(/./g, "-"), 
            line[1].replace(/./g, "^"), 
            line[2].replace(/./g, "-")
          ]
          
          error = new Error("TypeScript Error: " + message)
          error.stack = [
            "TypeScript Error: " + message, 
            "File: " + units[block].fileName, 
            "Start: " + start + ", Length: " + len, "", 
            "Line: " + line.join(""), 
            "------" + underline.join("")
          ].join("\n")

          throw error
    
        units.forEach (u) =>
          u.code = fs.readFileSync(u.fileName, "utf8") unless u.code
          compiler.addUnit u.code, u.fileName, false

        #resolveCode won't find dynamic code so explicitiy add the unit
        if(!(units.some (u) -> u.fileName is path))
          compiler.addUnit data, path, false

        compiler.typeCheck()

        compiler.emit true, (fileName) ->
            if fileName is path.replace(/\.ts$/, ".js")
                output
            else
                nulloutput
    catch err
      error = err.stack
    finally
      callback error, js

