-- [reanim-mcp bridge v1.0.2] live RootPart-mode control; safe to delete (backup: reanim.luau.bak)
pcall(function()
	local API = (type(_G.ReanimMCP) == "table" and _G.ReanimMCP) or nil
	if not API then return end
	if API.version == "1.0.2" then return end
	API.version = "1.0.2"
	if type(LimbReanimator) ~= "table" then return end

	local function modeNames()
		if type(LimbReanimator.GetModeNames) ~= "function" then return {} end
		local ok, names = pcall(LimbReanimator.GetModeNames)
		if ok and type(names) == "table" then return names end
		return {}
	end

	local function norm(s)
		local x = string.lower(tostring(s or ""))
		local y = x:match("^%s*(.-)%s*$")
		return y or x
	end

	API.GetRootModes = function() return modeNames() end

	API.GetRootMode = function()
		local names = modeNames()
		local mode = LimbReanimator.Mode or 0
		return {
			mode = mode,
			name = names[mode + 1],
			velocity = LimbReanimator.Velocity,
			init = LimbReanimator.InitMode,
		}
	end

	API.SetRootMode = function(id)
		local names = modeNames()
		if #names == 0 then return false, "mode list unavailable" end
		local target, pname = nil, nil
		local n = tonumber(id)
		if n and math.floor(n) == n then
			if n >= 0 and n < #names then target = n end -- 0-based builtin/plugin slot
			if target == nil and n >= 1 and n <= #names then target = n - 1 end -- 1-based UI number
			if target == nil then return false, "bad mode index: " .. tostring(id) end
		else
			local q = norm(id)
			if q == "" then return false, "empty query" end
			for i, nm in ipairs(names) do
				if norm(nm) == q then target = i - 1 break end
			end
			if target == nil then
				local subs = {}
				for i, nm in ipairs(names) do
					if norm(nm):find(q, 1, true) then subs[#subs + 1] = i - 1 end
				end
				if #subs == 1 then target = subs[1]
				elseif #subs > 1 then return false, "ambiguous (" .. #subs .. " matches)"
				else return false, "not found: " .. tostring(id) end
			end
		end
		LimbReanimator.Mode = target
		pname = names[target + 1]
		if type(SaveData) == "table" then
			if type(SaveData.Reanimator) ~= "table" then SaveData.Reanimator = {} end
			SaveData.Reanimator.LimbMode = target
			SaveData.Reanimator.LimbModeName = pname
		end
		if Util then
			if Util.UINotify then pcall(Util.UINotify, "RootPart mode: " .. tostring(pname))
			else pcall(Util.Notify, "RootPart mode: " .. tostring(pname)) end
		end
		return true, pname
	end

	API.SetRootVelocity = function(v)
		v = tonumber(v)
		if not v or v < 0 or v > 2 or math.floor(v) ~= v then
			return false, "velocity must be 0 (none), 1 (follow) or 2 (fling-like)"
		end
		LimbReanimator.Velocity = v
		if type(SaveData) == "table" then
			if type(SaveData.Reanimator) ~= "table" then SaveData.Reanimator = {} end
			SaveData.Reanimator.LimbVelocity = v
		end
		return true, v
	end

	API.SetRootInit = function(v)
		v = tonumber(v)
		if not v or v < 0 or v > 2 or math.floor(v) ~= v then
			return false, "init must be 0 (reset), 1 (CDSB+reset) or 2 (CDSB+SSE+kill)"
		end
		LimbReanimator.InitMode = v
		if type(SaveData) == "table" then
			if type(SaveData.Reanimator) ~= "table" then SaveData.Reanimator = {} end
			SaveData.Reanimator.LimbInitMode = v
		end
		return true, v
	end
end)
