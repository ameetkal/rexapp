'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { searchUsers } from '@/lib/firestore';

interface TaggedUser {
  id: string;
  name: string;
  email: string;
}

interface TaggedNonUser {
  name: string;
  email?: string;
}

interface UserTagInputProps {
  // For multi-user mode (existing functionality)
  taggedUsers?: TaggedUser[];
  taggedNonUsers?: TaggedNonUser[];
  onAddUser?: (user: TaggedUser) => void;
  onRemoveUser?: (userId: string) => void;
  onAddNonUser?: (nonUser: TaggedNonUser) => void;
  onRemoveNonUser?: (index: number) => void;
  maxUsers?: number;
  
  // For single-user smart text mode (new functionality)
  singleUser?: boolean;
  selectedUser?: TaggedUser | null;
  textValue?: string;
  onUserSelect?: (user: TaggedUser | null) => void;
  onTextChange?: (text: string) => void;
  
  placeholder?: string;
}

export default function UserTagInput({
  // Multi-user props
  taggedUsers = [],
  taggedNonUsers = [],
  onAddUser,
  onRemoveUser,
  onAddNonUser,
  onRemoveNonUser,
  maxUsers,
  
  // Single-user props
  singleUser = false,
  selectedUser = null,
  textValue = '',
  onUserSelect,
  onTextChange,
  
  placeholder = "Tag people you experienced this with..."
}: UserTagInputProps) {
  const [inputValue, setInputValue] = useState(textValue);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TaggedUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Update input value when textValue prop changes
  useEffect(() => {
    if (singleUser) {
      setInputValue(textValue);
    }
  }, [textValue, singleUser]);
  
  // Real user search function
  const searchUsersAPI = async (query: string): Promise<TaggedUser[]> => {
    try {
      const results = await searchUsers(query);
      return results
        .filter(user => {
          if (singleUser) {
            return selectedUser?.id !== user.id;
          } else {
            return !taggedUsers.some(tagged => tagged.id === user.id);
          }
        })
        .slice(0, 5); // Fewer results for less intrusion
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (value: string) => {
    setInputValue(value);
    
    // For single user mode, also update the parent's text value
    if (singleUser && onTextChange) {
      onTextChange(value);
    }
    
    if (value.trim().length >= 2) {
      setIsSearching(true);
      setShowDropdown(true);
      
      try {
        const results = await searchUsersAPI(value.trim());
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  const handleSelectUser = (user: TaggedUser) => {
    if (singleUser) {
      // Single user mode - tag the user and clear input
      if (onUserSelect) {
        onUserSelect(user);
      }
      setInputValue('');
      if (onTextChange) {
        onTextChange('');
      }
    } else {
      // Multi-user mode - existing functionality
      if (maxUsers && taggedUsers.length >= maxUsers) {
        return;
      }
      
      if (onAddUser) {
        onAddUser(user);
      }
      setInputValue('');
    }
    
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleRemoveSelectedUser = () => {
    if (singleUser && onUserSelect) {
      onUserSelect(null);
    }
  };

  const handleInviteNonUser = () => {
    const trimmedName = inputValue.trim();
    if (trimmedName && onAddNonUser) {
      // Simple email validation
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedName);
      
      if (isEmail) {
        onAddNonUser({ name: trimmedName.split('@')[0], email: trimmedName });
      } else {
        onAddNonUser({ name: trimmedName });
      }
      
      setInputValue('');
      setShowDropdown(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectUser(searchResults[0]);
      } else if (!singleUser && inputValue.trim()) {
        handleInviteNonUser();
      }
      // For single user mode, Enter just submits the form with current text
    }
  };

  // Single user mode render
  if (singleUser) {
    return (
      <div className="relative">
        <div className="min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <div className="flex flex-wrap gap-2">
            {/* Tagged user (if any) */}
            {selectedUser && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {selectedUser.name}
                <button
                  type="button"
                  onClick={handleRemoveSelectedUser}
                  className="ml-1 inline-flex items-center justify-center w-4 h-4 text-blue-600 hover:text-blue-800"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            )}
            
            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => inputValue.length >= 2 && setShowDropdown(true)}
              placeholder={!selectedUser && !inputValue ? placeholder : ""}
              className="flex-1 min-w-[120px] outline-none text-sm placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
          >
            {isSearching ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Searching...
              </div>
            ) : (
              searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {user.email}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Multi-user mode render (existing functionality)
  return (
    <div className="relative">
      <div className="min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <div className="flex flex-wrap gap-2">
          {/* Tagged existing users */}
          {taggedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {user.name}
              <button
                type="button"
                onClick={() => onRemoveUser?.(user.id)}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 text-blue-600 hover:text-blue-800"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
          
          {/* Tagged non-users (invites) */}
          {taggedNonUsers.map((nonUser, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
            >
              {nonUser.name}
              {nonUser.email && (
                <span className="ml-1 text-green-600">(invite)</span>
              )}
              <button
                type="button"
                onClick={() => onRemoveNonUser?.(index)}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 text-green-600 hover:text-green-800"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
          
          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => inputValue.length >= 2 && setShowDropdown(true)}
            placeholder={taggedUsers.length === 0 && taggedNonUsers.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] outline-none text-sm placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {isSearching ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Searching...
            </div>
          ) : (
            <>
              {searchResults.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                    Rex Users
                  </div>
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.email}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {inputValue.trim() && (
                <div>
                  {searchResults.length > 0 && (
                    <div className="border-t border-gray-200"></div>
                  )}
                  <button
                    onClick={handleInviteNonUser}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    <div className="flex items-center space-x-2">
                      <UserPlusIcon className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Invite &quot;{inputValue.trim()}&quot;
                        </div>
                        <div className="text-xs text-gray-500">
                          {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim())
                            ? "Send Rex invite to this email"
                            : "Add as non-Rex user"}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
              
              {!isSearching && searchResults.length === 0 && !inputValue.trim() && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Type to search for friends or add new ones
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
} 