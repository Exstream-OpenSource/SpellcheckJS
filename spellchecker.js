/** The Spellchecker object is a wrapper for the Hunspell functions in icu-hunspell.js */

var Spellchecker = {
	/**
	 * Loads the dictionary and affix files to be used for spell checking.
	 * 
	 * @param {string} sLanguageLocale - The name of the dictionary you want to use.  
	 * If you want to use en_US, pass "en_US" to the function.
	 * 
	 * Preconditions: The dictionary has been added to the Emscripten file system
	 * with FS.createPreloadedFile(5).  FS.createPreloadedFile(5) loads the file 
	 * asynchronously, so you need to be sure the file has been downloaded and added
	 * to the file system before calling loadDictionary(1).
	 * For more info on FS.createPreloadedFile(5) see http://kripken.github.io/emscripten-site/docs/api_reference/Filesystem-API.html#FS.createPreloadedFile
	 * 
	 * Post-conditions: The Hunspell object has been initialized and you can use 
	 * check(1) and suggest(1).
	 * 
	 */
	loadDictionary: function(sLanguageLocale)
	{
		var sAffixFile = sLanguageLocale + ".aff";
		var sDictionaryFile = sLanguageLocale + ".dic";
		
		// Save the stack state, we need to restore it at the end of the function.
		// We allocate memory in Emscripten's typed array for sAffixFile and sDictionaryFile.
		// We are responsible for freeing this memory ourselves.
		// See http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#call-compiled-c-c-code-directly-from-javascript
		var stackState = Runtime.stackSave();
		
		//Allocate memory for sAffixFile and sDictionaryFile.  We will pass the pointers to this memory to the compiled JS function.
		var ptrAff = allocate(intArrayFromString(sAffixFile), 'i8', ALLOC_STACK);
		var ptrDic = allocate(intArrayFromString(sDictionaryFile), 'i8', ALLOC_STACK);

		//Call the compiled _loadDictionary function.  In the C++ file, suggest takes two char *.
		//Module._loadDictionary is essentially a wrapper for the Hunspell constructor.
		var retVal = Module._loadDictionary(ptrAff, ptrDic);
		
		//Restore the stack and free the memory we allocated.
		Runtime.stackRestore(stackState);
		
		return retVal;
	},

	/**
	 * Given a word as a string, this function returns a number indicating whether the word is spelled correctly.
	 * @param {string} sWord - The word you want to check.
	 * @returns {Number} - A number indicating whether the word is spelled correctly.
	 * 0 - incorrect
     * 1 - correct
	 * 2 - correct but this word may be inappropriate
	 * 
	 * Preconditions: loadDictionary(1) has been called for a valid language + locale.
	 *    
	 */
	check: function(sWord)
	{
		// Save the stack state, we need to restore it at the end of the function.
		// We allocate memory in Emscripten's typed array for sWord.
		// We are responsible for freeing this memory ourselves.
		// See http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#call-compiled-c-c-code-directly-from-javascript
		var stackState = Runtime.stackSave();
		
		//Allocate memory in Emscripten's typed array for sWord.  We will pass the pointer to this memory to the compiled check() function.
		var ptrWord = allocate(intArrayFromString(sWord), 'i8', ALLOC_STACK);

		//Call the compiled check function. In the C++ file check takes a char *.
		//Module._check is essentially a wrapper for Hunspell::spell(1).
		var iCorrect = Module._check(ptrWord);
		
		//Restore the stack and free the memory we allocated.
		Runtime.stackRestore(stackState);
		
		return iCorrect;
	},

	/**
	 * Given a word as a string, this function returns spelling suggestions as an array of strings.
	 * @param {string} sWord - The word for which you want suggestions.
	 * @returns {string|Array} - Suggestions are returned as an array of strings.  If no suggestions are available, an empty array is returned.
	 *
	 * Pre-conditions: loadDictionary(1) has been called for a valid language + locale.
	 *
	 * Note: This function returns suggestions even if you pass it a correctly spelled word.
	 *
	 */
	suggest: function(sWord)
	{
		// Save the stack state, we need to restore it at the end of the function.
		// We allocate memory in Emscripten's typed array for sWord.
		// We are responsible for freeing this memory ourselves.
		// See http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html#call-compiled-c-c-code-directly-from-javascript
		var stackState = Runtime.stackSave();

		//Allocate memory for a number that Module._getSuggestions will set.  This number will tell us how many suggestions there are.
		var ptrNumSuggestions = allocate([], 'i8', ALLOC_STACK);

		//Allocate memory for the word we passed in.  We will pass the pointer to this memory to Module._getSuggestions.
		var ptrWord = allocate(intArrayFromString(sWord), 'i8', ALLOC_STACK);

		//Call the compiled getSuggestions function.  It takes a pointer to a string containing the word and a pointer to an number.
		//It returns a pointer to memory containing the suggestions.  The pointer to the number represents the number of suggestions.
		//Module._getSuggestions is a wrapper for Hunspell::suggest(2).
		var ptrSuggestions = Module._getSuggestions(ptrWord, ptrNumSuggestions);

		//Get the number of suggestions from Emscripten's memory array.
		var numSuggestions = Module.HEAPU8.subarray(ptrNumSuggestions, ptrNumSuggestions+1)[0];

		//Get an array of pointers to the suggestion strings.
		var suggestionPointers = Module.HEAP32.subarray(ptrSuggestions>>2, (ptrSuggestions>>2)+numSuggestions);

		//Loop over the suggestion pointers, adding suggestions to an array.
		var suggestions = [];
		for (var i = 0; i < suggestionPointers.length; i++)
		{
			var ptr = suggestionPointers[i];
			if (ptr !== 0)
				suggestions.push(Pointer_stringify(ptr));	//Pointer_stringify returns the string pointed to by ptr.
		}

		//Call the compiled freeSuggestions function.  This frees the memory allocated by getSuggestions.
		//Module._freeSuggestions is a wrapper for Hunspell::free_list(2).
		Module._freeSuggestions(ptrSuggestions, ptrNumSuggestions);

		//Restore the stack and free any memory allocated in this function.
		Runtime.stackRestore(stackState);

		return suggestions;
	},

};
