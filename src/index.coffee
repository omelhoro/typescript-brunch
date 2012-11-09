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
    @settings.resolve = true

    @settings.mapSourceFiles = false

    @units = [{fileName: sysPath.join __dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts"}]

  console.log 'con'
    
  compile: (data, path, callback) ->
    try
        console.log 'compile', data, path
        js = ""
        output =
            Write: (value) ->
              js += value
            WriteLine: (value) ->
              js += value + "\n"
            Close: ->

        compiler = new TypeScript.TypeScriptCompiler(null, null, new TypeScript.NullLogger(), @settings)
        compiler.parser.errorRecovery = true
        env = new TypeScript.CompilationEnvironment(@settings, io)
        resolver = new TypeScript.CodeResolver(env)

        units = @units.slice()

        # @resolver.resolveCode path, "", false,
        #   postResolution: (file, code) ->
        #       unless units.some((u) ->
        #       u.fileName is code.path
        #     )
        #       units.push
        #         fileName: code.path
        #         code: code.content
        #   postResolutionError: (file, message) ->
        #     throw new Error("TypeScript Error: " + message + "\n File: " + file)

        compiler.setErrorCallback (start, len, message, block) ->
          error = new Error("TypeScript Error: " + message)
          error.stack = ["TypeScript Error: " + message, "Code Block: " + block, "Start: " + start + ", Length: " + len].join("\n")
          throw error
        
        compiler.addUnit data, path
        
        units.forEach (u) =>
          u.code = fs.readFileSync(u.fileName, "utf8") unless u.code
          compiler.addUnit u.code, u.fileName, false

        compiler.typeCheck()

        compiler.emit true, (fn) ->
            console.log 'emit', fn
            if fn is path.replace(/\.ts$/, ".js")
                output
            else
                nulloutput
    catch err
      error = err
    finally
      callback error, js

