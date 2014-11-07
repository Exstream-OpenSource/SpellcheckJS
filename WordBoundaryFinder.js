/** The WordBoundaryFinder object is a wrapper for the ICU functions in icu-hunspell.js.  */
var WordBoundaryFinder = {
	/**
	* initialize() loads the data library ICU depends on into the Emscripten file system
	* and sets the data directory ICU will search for the data library.
	*/
	initialize: function()
	{
		//Icu will look for its data library at /icudt54l.dat.
		FS.createPreloadedFile("/", "icudt54l.dat", "../../libs/spellchecker/icu.data", true, false);
		//Sets the ICU data directory to "/".
		Module._setDataDirectory();
	},

	/**
	* configure() creates a new ICU BreakIterator for the specified language and locale.
	* Any existing BreakIterators are freed.
	* @param {string} sLanguageLocale - The language and locale used by the BreakIterator.
	* This parameter should look like "en_US" or "fr_FR".
	* @returns {Number} - 1 indicates successful configuration.  0 indicates a failure.
	*/
	configure: function(sLanguageLocale)
	{
		Module._freeBreakIterator();

		var parts = sLanguageLocale.split("_");
		var sLanguage = parts[0];
		var sLocale = parts[1];

		// Save the stack state, we need to restore it at the end of the function.
		// We allocate memory in Emscripten's typed array for sLanguageLocale.
		// We are responsible for freeing this memory ourselves.
		// See http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#call-compiled-c-c-code-directly-from-javascript
		var stackState = Runtime.stackSave();

		//Allocate memory for the language and locale strings.  We will pass the pointers to these strings to Module._configure.
		var ptrLanguage = allocate(intArrayFromString(sLanguage), 'i8', ALLOC_STACK);
		var ptrLocale = allocate(intArrayFromString(sLocale), 'i8', ALLOC_STACK);

		var result = Module._configureBreakIterator(ptrLanguage, ptrLocale);

		//Restore the stack and free any memory allocated in this function.
		Runtime.stackRestore(stackState);

		return result;
	},

	/**
	* findBoundaries() returns an array of numbers representing the indices of the beginning and end of each word
	* in the given sText parameter.
	* @param {string} sText - A string of text.
	* returns {Number|Array} - An array of numbers where each number represents the index in sText where a word begins or ends.
	* Note: punctuation is considered a word.
	*/
	findBoundaries: function(sText)
	{
		// Save the stack state, we need to restore it at the end of the function.
		// We allocate memory in Emscripten's typed array for sText.
		// We are responsible for freeing this memory ourselves.
		// See http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#call-compiled-c-c-code-directly-from-javascript
		var stackState = Runtime.stackSave();

		//Allocate memory for a number that Module._findBoundaries will set.  This number will tell us how many boundaries there are.
		var ptrNumBoundaries = allocate([], 'i8', ALLOC_STACK);

		//Allocate memory for the word we passed in.  We will pass the pointer to this memory to Module._findBoundaries.
		var ptrText = allocate(intArrayFromString(sText), 'i8', ALLOC_STACK);

		//Call the compiled findBoundaries function.  It takes a pointer to a string containing the word and a pointer to an number.
		//It returns a pointer to memory containing the boundaries.  The pointer to the number represents the number of boundaries.
		var ptrBoundaries = Module._findBoundaries(ptrText, ptrNumBoundaries);

		//Get the number of boundaries from Emscripten's memory array.
		var numBoundaries = Module.HEAPU8.subarray(ptrNumBoundaries, ptrNumBoundaries+1)[0];

		//Get an array of boundaries.
		var tempBoundaries = Module.HEAP32.subarray(ptrBoundaries>>2, (ptrBoundaries>>2)+numBoundaries);
		var boundaries = [];
		for (var i = 0; i < tempBoundaries.length; i++)
			boundaries[i] = tempBoundaries[i];
		//Call the compiled freeboundaries function.  This frees the memory allocated by findBoundaries.
		Module._freeBoundaries(ptrBoundaries, ptrNumBoundaries);

		//Restore the stack and free any memory allocated in this function.
		Runtime.stackRestore(stackState);

		return boundaries;
	},
}
