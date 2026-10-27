with open('assets/simdeep.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''      '<div class="simdeep-row-fields">' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="team" aria-label="Include team filter" title="Filter by a specific team in the playoff projection"> Team' +
          '<div class="combo">' +
            '<input type="text" class="simdeep-team-search" placeholder="Type a team name" autocomplete="off" aria-label="Team" role="combobox" aria-expanded="false" title="Search for a team to filter by">' +
            '<div class="combo-list hidden" role="listbox"></div>' +
          '</div>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="confChamp" aria-label="Include conf champ filter" title="Filter by conference champion (select conference; if team is also set, requires that team to be the champ)"> Conf champ' +
          '<select class="simdeep-conf-champ" aria-label="Conference champion" title="Choose a conference; if Team is also selected, that team must be the conference champion">' +
            '<option value="">Any</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="overall" aria-label="Include overall record filter" title="Filter by overall win/loss record (use operators for greater/less than)"> Overall' +
          '<select class="simdeep-op-ow" aria-label="Overall wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
          '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Wins">' +
          '<select class="simdeep-op-ol" aria-label="Overall losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
          '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Losses" title="Overall losses filter (use operator for comparisons)"> <br><span class="simdeep-record-range overall" style="font-size:0.75rem;color:var(--muted);"></span>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="conf" aria-label="Include conf record filter" title="Filter by conference win/loss record (use operators for greater/less than)"> Conf' +
          '<select class="simdeep-op-cw" aria-label="Conf wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
          '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Conf Wins">' +
          '<select class="simdeep-op-cl" aria-label="Conf losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
          '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Conf Losses" title="Conference losses filter (use operator for comparisons)"> <br><span class="simdeep-record-range conf" style="font-size:0.75rem;color:var(--muted);"></span>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="inField" aria-label="Team must be in projected field" title="Only count runs where this team appears in the playoff field"> In field' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="champion" aria-label="Filter by champion team" title="Only match runs where this team wins the championship"> Champion' +
          '<input type="text" class="simdeep-champion-search" placeholder="Team name" autocomplete="off" aria-label="Champion team" style="width: 8rem;">' +
        '</label>' +
      '</div>';'''

new = '''      '<div class="simdeep-row-fields">' +
        '<div class="simdeep-param-group" data-param="team">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="team" checked aria-label="Team filter" title="Filter by a specific team"> Team</label>' +
          '<div class="simdeep-param-body">' +
            '<div class="combo">' +
              '<input type="text" class="simdeep-team-search" placeholder="Type a team name" autocomplete="off" aria-label="Team" role="combobox" aria-expanded="false" title="Search for a team to filter by">' +
              '<div class="combo-list hidden" role="listbox"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="confChamp">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="confChamp" checked aria-label="Conf champ filter" title="Filter by conference champion"> Conf champ</label>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-conf-champ" aria-label="Conference champion" title="Choose a conference"><option value="">Any</option></select>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="overall">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="overall" checked aria-label="Overall record filter" title="Filter by overall win/loss record"> Overall</label>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-op-ow" aria-label="Overall wins operator" title="Comparison operator"><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
            '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Wins">' +
            '<select class="simdeep-op-ol" aria-label="Overall losses operator" title="Comparison operator"><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
            '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Losses">' +
            '<span class="simdeep-record-range overall" style="font-size:0.7rem;color:var(--muted);display:inline-block;margin-left:0.3rem;"></span>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="conf">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="conf" checked aria-label="Conf record filter" title="Filter by conference win/loss record"> Conf</label>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-op-cw" aria-label="Conf wins operator" title="Comparison operator"><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
            '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Conf Wins">' +
            '<select class="simdeep-op-cl" aria-label="Conf losses operator" title="Comparison operator"><option value="=" selected>=</option><option value=">">></option><option value="<">&lt;</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option></select>' +
            '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Conf Losses">' +
            '<span class="simdeep-record-range conf" style="font-size:0.7rem;color:var(--muted);display:inline-block;margin-left:0.3rem;"></span>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="inField">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="inField" aria-label="In field" title="Only count runs where team is in projected playoff field"> In field</label>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="champion">' +
          '<label class="simdeep-param-label"><input type="checkbox" class="simdeep-param-check" data-param="champion" aria-label="Champion filter" title="Only match runs where this team is champion"> Champion</label>' +
          '<div class="simdeep-param-body">' +
            '<input type="text" class="simdeep-champion-search" placeholder="Team name" autocomplete="off" aria-label="Champion team" style="width: 8rem;">' +
          '</div>' +
        '</div>' +
      '</div>';'''

if old not in content:
    print('old string not found, checking if new already present')
    if new in content:
        print('new string already present')
    else:
        print('neither found')
else:
    content = content.replace(old, new)
    with open('assets/simdeep.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('replaced')
