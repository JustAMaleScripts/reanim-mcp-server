-- [reanim-mcp bridge all-in-one v1.0.2] single-file build of bridge v1.0.0 + v1.0.1 + v1.0.2
-- (backup: reanim.luau.bak; safe to delete the whole block; idempotent on re-append)
-- [reanim-mcp bridge v1.0.0] appended by reanim-mcp-server; safe to delete (backup: reanim.luau.bak)
-- Exposes live control without touching any existing logic. Everything runs inside
-- pcall, so if any upvalue is missing the bridge silently stays inert.
pcall(function()
	if type(MovementStyles) ~= "table" or type(DanceableDances) ~= "table" then return end
	_G.ReanimMCP = (type(_G.ReanimMCP) == "table" and _G.ReanimMCP) or {}
	local API = _G.ReanimMCP
	API.version = "1.0.0"
	API.source = "reanim.luau bridge"

	local function norm(s)
		local x = string.lower(tostring(s or ""))
		local y = x:match("^%s*(.-)%s*$")
		return y or x
	end

	local function findIn(list, id)
		if type(list) ~= "table" or #list == 0 then return nil, "empty list" end
		local n = tonumber(id)
		if n and n >= 1 and n <= #list and math.floor(n) == n then
			return list[n], nil
		end
		local q = norm(id)
		if q == "" then return nil, "empty query" end
		for _, m in ipairs(list) do
			if type(m) == "table" and norm(m.InternalName) == q then return m, nil end
		end
		for _, m in ipairs(list) do
			if type(m) == "table" and norm(m.Name) == q then return m, nil end
		end
		local subs = {}
		for _, m in ipairs(list) do
			if type(m) == "table" and type(m.Name) == "string" and norm(m.Name):find(q, 1, true) then
				subs[#subs + 1] = m
			end
		end
		if #subs == 1 then return subs[1], nil end
		if #subs > 1 then return nil, "ambiguous (" .. #subs .. " matches)" end
		return nil, "not found: " .. tostring(id)
	end

	local function say(t)
		if Util then
			if Util.UINotify then pcall(Util.UINotify, t) else pcall(Util.Notify, t) end
		end
	end

	local function summ(list)
		local out = {}
		for i, m in ipairs(list) do
			if type(m) == "table" then
				out[#out + 1] = {
					index = i,
					name = m.Name,
					internalName = m.InternalName,
					description = type(m.Description) == "string" and m.Description:sub(1, 160) or nil,
				}
			end
		end
		return out
	end

	API.Ping = function()
		return { ok = true, version = API.version, movesets = #MovementStyles, dances = #DanceableDances }
	end

	API.ListMovesets = function() return summ(MovementStyles) end
	API.ListDances = function() return summ(DanceableDances) end

	API.CheckMovesets = function()
		local idx = (type(SaveData) == "table" and SaveData.MovesetIndex) or nil
		return { total = #MovementStyles, savedIndex = idx }
	end
	API.CheckDances = function() return { total = #DanceableDances } end

	API.GetMoveset = function()
		local m = MovementStyles[MovementStyleIndex]
		if type(m) ~= "table" then return nil end
		return { index = MovementStyleIndex, name = m.Name, internalName = m.InternalName }
	end

	API.SwitchMoveset = function(id)
		local m, e = findIn(MovementStyles, id)
		if not m then return false, e end
		local idx = table.find(MovementStyles, m)
		if not idx then return false, "registry changed" end
		MovementStyleIndex = idx
		if Util then Util.MovesetPickedByUser = true end
		if type(SaveData) == "table" then
			SaveData.MovesetIndex = idx
			SaveData.MovesetHash = m.Hash or nil
		end
		say("Moveset: " .. tostring(m.Name))
		return true, m.Name
	end

	API.GetDance = function()
		if type(CurrentDance) ~= "table" then return nil end
		return { name = CurrentDance.Name, internalName = CurrentDance.InternalName }
	end

	API.SwitchDance = function(id)
		local m, e = findIn(DanceableDances, id)
		if not m then return false, e end
		CurrentDance = m
		say("Dance: " .. tostring(m.Name))
		return true, m.Name
	end

	API.StopDance = function()
		CurrentDance = nil
		say("Dance stopped")
		return true
	end

	API.PressKey = function(key)
		if type(HandleKeybind) ~= "function" then return false, "no keybind handler" end
		local ok, r = pcall(HandleKeybind, key)
		return ok, r
	end

	API.GetKeybinds = function()
		local out = {}
		if type(Keybinds) == "table" then
			for k, d in pairs(Keybinds) do
				out[k] = (type(d) == "table" and d.Name) or nil
			end
		end
		return out
	end

	API.GetTheme = function()
		local c = (type(SaveData) == "table" and type(SaveData.Custom) == "table") and SaveData.Custom or {}
		return {
			AccentMode = c.AccentMode, HarmonyMode = c.HarmonyMode, UIAccent = c.UIAccent,
			ColorSpeed = c.ColorSpeed, ColorSat = c.ColorSat, ColorBright = c.ColorBright,
			TriColorMode = c.TriColorMode, TriColor = c.TriColor,
			IntroColorMode = c.IntroColorMode, IntroColor = c.IntroColor,
		}
	end

	API.SetTheme = function(patch)
		if type(patch) ~= "table" then return false, "patch must be a table" end
		if type(SaveData) ~= "table" then return false, "no SaveData" end
		if type(SaveData.Custom) ~= "table" then SaveData.Custom = {} end
		local applied = {}
		for k, v in pairs(patch) do
			SaveData.Custom[k] = v
			applied[k] = v
			if Util and Util.FX and Util.FX.SetCfg then pcall(Util.FX.SetCfg, k, v) end
		end
		say("Theme updated")
		return true, applied
	end

	API.GetCustom = function(k)
		if type(SaveData) ~= "table" or type(SaveData.Custom) ~= "table" then return nil end
		if k ~= nil then return SaveData.Custom[k] end
		return SaveData.Custom
	end

	API.SetCustom = function(k, v)
		if type(k) ~= "string" or k == "" then return false, "bad key" end
		if type(SaveData) ~= "table" then return false, "no SaveData" end
		if type(SaveData.Custom) ~= "table" then SaveData.Custom = {} end
		SaveData.Custom[k] = v
		if Util and Util.FX and Util.FX.SetCfg then pcall(Util.FX.SetCfg, k, v) end
		return true, v
	end

	API.SetLowEnd = function(on)
		if type(SaveData) ~= "table" then return false, "no SaveData" end
		if type(SaveData.Custom) ~= "table" then SaveData.Custom = {} end
		SaveData.Custom.LowEnd = (on == true)
		if Util and Util.FX and Util.FX.SetLowEnd then
			pcall(Util.FX.SetLowEnd, on == true)
		elseif Util and Util.FX and Util.FX.SetCfg then
			pcall(Util.FX.SetCfg, "LowEnd", on == true)
		end
		return true, SaveData.Custom.LowEnd
	end

	API.Help = function()
		return "ReanimMCP v1.0.0: Ping ListMovesets ListDances CheckMovesets CheckDances GetMoveset SwitchMoveset GetDance SwitchDance StopDance PressKey GetKeybinds GetTheme SetTheme GetCustom SetCustom SetLowEnd Help"
	end
end)

-- [reanim-mcp bridge v1.0.1] disambiguation helpers; safe to delete (backup: reanim.luau.bak)
pcall(function()
	local API = (type(_G.ReanimMCP) == "table" and _G.ReanimMCP) or nil
	if not API then return end
	if API.version == "1.0.1" then return end
	API.version = "1.0.1"
	-- runtime-index switchers (index = position in the live registry, see ListDances/ListMovesets)
	API.SwitchDanceIndex = function(n)
		n = tonumber(n)
		if not n or n < 1 or n > #DanceableDances or math.floor(n) ~= n then
			return false, "bad dance index: " .. tostring(n)
		end
		local m = DanceableDances[n]
		CurrentDance = m
		if Util then
			if Util.UINotify then pcall(Util.UINotify, "Dance: " .. tostring(m.Name))
			else pcall(Util.Notify, "Dance: " .. tostring(m.Name)) end
		end
		return true, m.Name
	end
	API.SwitchMovesetIndex = function(n)
		n = tonumber(n)
		if not n or n < 1 or n > #MovementStyles or math.floor(n) ~= n then
			return false, "bad moveset index: " .. tostring(n)
		end
		local m = MovementStyles[n]
		MovementStyleIndex = n
		if Util then Util.MovesetPickedByUser = true end
		if type(SaveData) == "table" then
			SaveData.MovesetIndex = n
			SaveData.MovesetHash = m.Hash or nil
		end
		if Util then
			if Util.UINotify then pcall(Util.UINotify, "Moveset: " .. tostring(m.Name))
			else pcall(Util.Notify, "Moveset: " .. tostring(m.Name)) end
		end
		return true, m.Name
	end
	-- describe matches for an ambiguous name so callers can pick an index
	API.FindDances = function(q)
		q = string.lower(tostring(q or ""))
		local out = {}
		for i, m in ipairs(DanceableDances) do
			if type(m) == "table" and type(m.Name) == "string"
				and string.lower(m.Name):find(q, 1, true) then
				out[#out + 1] = { index = i, name = m.Name,
					description = type(m.Description) == "string" and m.Description:sub(1, 120) or nil }
			end
		end
		return out
	end
end)

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
