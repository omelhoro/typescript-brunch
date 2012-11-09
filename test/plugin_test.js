describe('Plugin', function() {
  var plugin;

  beforeEach(function() {
    plugin = new Plugin({});
  });

  it('should be an object', function() {
    expect(plugin).to.be.ok;
  });

  it('should has #compile method', function() {
    expect(plugin.compile).to.be.an.instanceof(Function);
  });

  it('should compile and produce valid result', function(done) {
    var content = 'var a = 6;';
    var expected = 'var a = 6;\n';

    plugin.compile(content, 'file.ts', function(error, data) {
      expect(error).not.to.be.ok;
      expect(data).to.equal(expected)
      done();
    });
  });

  it('should return error', function(done) {
    var content = 'var num = 1; num = "1"';
    
    plugin.compile(content, 'file.ts', function(error, data) {
      expect(error).to.be.ok;
      console.log(error);
      console.log(error.stack)
      console.log(data);
      done();
    });
  });
});
