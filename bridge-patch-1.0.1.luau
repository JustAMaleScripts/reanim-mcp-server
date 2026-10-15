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
