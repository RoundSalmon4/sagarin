with open('assets/simdeep.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace checkbox inputs with button toggles and add click handler
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="team" aria-label="Include team filter" title="Filter by a specific team in the playoff projection"> Team',
    '<button type="button" class="simdeep-param-btn active" data-param="team" aria-label="Team filter" title="Filter by a specific team">Team</button>'
)
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="confChamp" aria-label="Include conf champ filter" title="Filter by conference champion (select conference; if team is also set, requires that team to be the champ)"> Conf champ',
    '<button type="button" class="simdeep-param-btn active" data-param="confChamp" aria-label="Conf champ filter" title="Filter by conference champion">Conf champ</button>'
)
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="overall" aria-label="Include overall record filter" title="Filter by overall win/loss record (use operators for greater/less than)"> Overall',
    '<button type="button" class="simdeep-param-btn active" data-param="overall" aria-label="Overall record filter" title="Filter by overall win/loss record">Overall</button>'
)
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="conf" aria-label="Include conf record filter" title="Filter by conference win/loss record (use operators for greater/less than)"> Conf',
    '<button type="button" class="simdeep-param-btn active" data-param="conf" aria-label="Conf record filter" title="Filter by conference win/loss record">Conf</button>'
)
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="inField" aria-label="Team must be in projected field" title="Only count runs where this team appears in the playoff field"> In field',
    '<button type="button" class="simdeep-param-btn active" data-param="inField" aria-label="In field" title="Only count runs where team is in projected playoff field">In field</button>'
)
content = content.replace(
    '<input type="checkbox" class="simdeep-param-check" data-param="champion" aria-label="Filter by champion team" title="Only match runs where this team wins the championship"> Champion',
    '<button type="button" class="simdeep-param-btn active" data-param="champion" aria-label="Champion filter" title="Only match runs where this team is champion">Champion</button>'
)

with open('assets/simdeep.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('buttons replaced')
